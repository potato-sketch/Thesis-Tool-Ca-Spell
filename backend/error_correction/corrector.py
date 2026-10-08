"""ERROR CORRECTION MODULE: runs the stages in order for every misspelled word.

    Edit distance computation   (error_correction/edit_distance.py)
      -> Candidate generation   (error_correction/candidate_generation.py)
      -> Context-based candidate ranking   (context_ranking.py)
           TA-WDCA: DNA, CLDC, DCS   (ta_wdca/)
           POS Context Scoring (PAS) and UD Context Scoring (UDS), from the corpus frequency profile
      -> Final candidate scoring   (final_scoring.py)
      -> Suggested words (ranked list)

Input is the error candidates from the Error Detection Module (connector A) and
the English and Tagalog word-list automata (connector B). Spelling and hyphenation
errors are corrected through the word lists. A context error (a verb whose aspect
contradicts a time word) is a correctly spelled word, so its candidates come from
the verb prefixes within the edit distance threshold, and only candidates that
resolve the conflict are kept. A word with both errors gets both fixes combined.
"""

from dataclasses import replace

from error_correction.candidate_generation import Candidate, generate_candidates
from error_correction.context_ranking import rank_candidates
from error_correction.edit_distance import edit_distance
from error_detection.annotation import VERB_PREFIX_ANNOTATIONS
from error_detection.code_switching import check_code_switching
from error_detection.morphology import PREFIXES
from preprocessing.automaton import WordAutomaton

MAX_SUGGESTIONS = 5
MAX_CONSOLIDATED_BASES = 10

_PREFIX_AUTOMATON = WordAutomaton.from_words(PREFIXES)
_ASPECT_PREFIX_AUTOMATON = WordAutomaton.from_words(VERB_PREFIX_ANNOTATIONS)


def _correction_target(text, check):
    """(start, end, vocabulary) of the part of the token to correct, using the
    Error Detection Module's finding of which part holds the error."""
    analysis = check["analysis"]
    if check["error_part"] == "root" and analysis.get("root"):
        root = analysis["root"]
        start = text.find(root, len(analysis.get("affix", "")))
        if start >= 0:
            return start, start + len(root), "root"
    if check["error_part"] == "affix" and analysis.get("affix") and text.startswith(analysis["affix"]):
        return 0, len(analysis["affix"]), "affix"
    return 0, len(text), "word"


def _match_case(original, word):
    if len(original) > 1 and original.isupper():
        return word.upper()
    if original[:1].isupper():
        return word[:1].upper() + word[1:]
    return word


def _candidates_for(text, check, lexicon):
    if check["error_type"] == "hyphenation" and check["expected"]:
        return [Candidate(check["expected"], edit_distance(text, check["expected"]))]

    start, end, kind = _correction_target(text, check)
    whole_word = [
        replace(candidate, word=_match_case(text, candidate.word))
        for candidate in generate_candidates(text, lexicon.automata)
    ]
    if kind == "word":
        return whole_word

    # The flagged root or affix is a guess about where the typo is, so whole-word
    # candidates compete with it. A corrected root or affix should leave a word the
    # Error Detection Module accepts.
    part = text[start:end]
    automata = {"tagalog": _PREFIX_AUTOMATON} if kind == "affix" else lexicon.automata
    part_level = [
        replace(candidate, word=text[:start] + _match_case(part, candidate.word) + text[end:])
        for candidate in generate_candidates(part, automata)
    ]
    part_level = [c for c in part_level if check_code_switching(c.word, lexicon).valid]

    merged = {}
    for candidate in part_level + whole_word:
        merged.setdefault(candidate.word, candidate)
    return list(merged.values())


def _prefix_candidates(text, annotation, lexicon):
    """Swaps the verb's aspect prefix for a nearby prefix: "Nag-submit" -> "Mag-submit"."""
    trigger = (annotation or {}).get("trigger", "")
    if not trigger.startswith("prefix "):
        return []
    prefix = trigger[len("prefix "):].rstrip("-")
    if not text.casefold().startswith(prefix):
        return []
    part, rest = text[: len(prefix)], text[len(prefix):]
    candidates = [
        replace(candidate, word=_match_case(part, candidate.word) + rest)
        for candidate in generate_candidates(part, {"tagalog": _ASPECT_PREFIX_AUTOMATON})
    ]
    return [c for c in candidates if check_code_switching(c.word, lexicon).valid]


def _consolidate(spelling_candidates, annotation, lexicon):
    """For a word with both errors: the spelling fixes, each also with its aspect prefix swapped,
    so "Nag-submt" can become "Mag-submit" (one fix for the typo, one for the tense)."""
    combined = []
    for base in spelling_candidates[:MAX_CONSOLIDATED_BASES]:
        for swapped in _prefix_candidates(base.word, annotation, lexicon):
            combined.append(replace(swapped, distance=base.distance + swapped.distance, languages=base.languages))
    return combined


def _unique(candidates):
    best = {}
    for candidate in candidates:
        if candidate.word not in best or candidate.distance < best[candidate.word].distance:
            best[candidate.word] = candidate
    return list(best.values())


def _sentence_bounds(doc, token):
    if doc.has_annotation("SENT_START"):
        return token.sent.start_char, token.sent.end_char
    return 0, len(doc.text)


def correct_errors(doc, detections, errors, lexicon, parse_many, limit=MAX_SUGGESTIONS, profile=None):
    """Returns {token index: [suggestion, ...]} for the errors in `errors` that can be corrected.

    `detections` and `errors` are the output of error_detection.detector.detect_errors.
    """
    suggestions = {}
    for error in errors:
        detection = detections[error["index"]]
        check = detection["check"]
        token = doc[error["index"]]
        has_spelling_error = bool(check and not check["valid"])
        has_context_error = "context" in error["reasons"]
        if has_spelling_error:
            candidates = _candidates_for(token.text, check, lexicon)
            if has_context_error:
                candidates += _consolidate(candidates, detection["annotation"], lexicon)
        elif has_context_error:
            candidates = _prefix_candidates(token.text, detection["annotation"], lexicon)
        else:
            continue

        sentence_start, sentence_end = _sentence_bounds(doc, token)
        start = token.idx - sentence_start
        unique = _unique(candidates)
        ranked = rank_candidates(
            doc.text[sentence_start:sentence_end], start, start + len(token.text),
            unique, lexicon, parse_many, profile,
        )
        rejected = []
        if has_context_error:
            resolved = [c for c in ranked if not c.scores.get("aspect_conflict", 1)]
            # A word with both errors falls back to spelling-only fixes when no candidate fixes both.
            if resolved:
                rejected = [c.word for c in ranked if c.scores.get("aspect_conflict", 1)][:3]
            ranked = resolved or (ranked if has_spelling_error else [])
        summary = {"candidates_considered": len(unique), "rejected_for_tense_conflict": rejected}
        suggestions[error["index"]] = [
            {
                "word": candidate.word,
                "score": round(candidate.score, 4),
                "edit_distance": candidate.distance,
                "languages": list(candidate.languages),
                "scores": {name: round(value, 4) for name, value in candidate.scores.items()},
                "details": {**(candidate.details or {}), **summary},
            }
            for candidate in ranked[:limit]
        ]
    return suggestions
