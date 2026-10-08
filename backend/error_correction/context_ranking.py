"""ERROR CORRECTION MODULE: Context-Based Candidate Ranking.

Each candidate replaces the misspelled word in its sentence and the candidate sentence is parsed again:

    TA-WDCA               DNA, CLDC and DCS (see the ta_wdca package)
    POS Context Scoring   the POS Annotation Score (PAS), from the corpus frequency profile
    UD Context Scoring    the Universal Dependency Score (UDS), from the corpus frequency profile

PAS and UDS make up the Context Score (CS); without a frequency profile CS is left out.
"""

from dataclasses import dataclass, field

from error_correction.context_scoring import context_score
from error_correction.final_scoring import edit_distance_score, final_candidate_score
from ta_wdca.dcs import dependency_compatibility


@dataclass
class ScoredCandidate:
    word: str
    distance: int
    languages: tuple
    score: float
    scores: dict = field(default_factory=dict)
    details: dict | None = None  # the full scoring breakdown, for showing how the score was reached


def _token_at(doc, start):
    return next((token for token in doc if token.idx == start), None)


def rank_candidates(sentence, start, end, candidates, lexicon, parse_many, profile=None):
    """Ranks candidates for the word at sentence[start:end], best first.

    `candidates` hold the full replacement word. `parse_many` turns a list of
    texts into parsed Docs (preprocessing.pipeline.preprocess_many). `profile` is the
    corpus FrequencyProfile, or None when no corpus has been loaded.
    """
    if not candidates:
        return []
    texts = [sentence] + [sentence[:start] + candidate.word + sentence[end:] for candidate in candidates]
    original_doc, *candidate_docs = parse_many(texts)
    original = _token_at(original_doc, start)

    ranked = []
    for candidate, doc in zip(candidates, candidate_docs):
        token = _token_at(doc, start)
        context = (
            dependency_compatibility(original, token, lexicon)
            if original is not None and token is not None
            else None
        )
        corpus = context_score(token, profile, lexicon) if profile and token is not None else None
        eds = edit_distance_score(candidate.distance)
        dcs = context["dcs"] if context else 0.0
        cs = corpus["cs"] if corpus else None
        scores = {"edit_distance": eds, "dependency_compatibility": dcs}
        if context:
            scores.update(
                dependency_neighborhood=context["dna"]["score"],
                cross_language=context["cldc"]["score"],
                aspect_conflict=context["dna"]["aspect_conflict"],
            )
        if corpus:
            scores.update(pas=corpus["pas"], uds=corpus["uds"], context_score=corpus["cs"])
        details = {}
        if context:
            details.update(dna=context["dna"], cldc=context["cldc"])
        if corpus:
            details["context"] = corpus
        ranked.append(
            ScoredCandidate(
                candidate.word, candidate.distance, candidate.languages,
                final_candidate_score(eds, dcs, cs), scores, details or None,
            )
        )
    ranked.sort(key=lambda c: (-c.score, c.distance, c.word))
    return ranked
