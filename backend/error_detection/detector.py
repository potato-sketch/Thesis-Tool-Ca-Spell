"""ERROR DETECTION MODULE: runs the stages in order and collects error candidates.

    Dictionary look-up
      -> Code-switching & compound word checking   (only tokens not in a word list)
    Context-Aware Linguistic Annotation            (every token, using POS/UD)
      -> Context Compatibility Analysis

Tokens that fail the spelling checks or the compatibility analysis are error
candidates for the Error Correction Module.
"""

from error_detection.annotation import annotate
from error_detection.code_switching import WordCheck, check_code_switching
from error_detection.compatibility import check_compatibility
from error_detection.dictionary_lookup import dictionary_lookup, is_checkable


def detect_errors(doc, lexicon):
    """Returns ({token index: detection result}, [error candidates])."""
    results = {}
    for token in doc:
        check = None
        if is_checkable(token):
            languages = dictionary_lookup(token, lexicon)
            if languages:
                check = WordCheck(valid=True, method="dictionary", analysis={"languages": languages})
            else:
                check = check_code_switching(token.text, lexicon)
        results[token.i] = {"check": check.as_dict() if check else None}

    # Annotation and compatibility run on every token, including correctly spelled
    # ones: "Nag-submit ako bukas." has no misspelling but is still an error.
    annotations = {}
    for token in doc:
        annotation = annotate(token, lexicon)
        results[token.i]["annotation"] = annotation
        if annotation:
            annotations[token.i] = annotation
    conflicts = check_compatibility(doc, annotations)

    candidates = []
    for token in doc:
        result = results[token.i]
        result["context_conflicts"] = conflicts.get(token.i, [])
        reasons = []
        check = result["check"]
        if check and not check["valid"]:
            reasons.append(check["error_type"])  # "spelling" or "hyphenation"
        if result["context_conflicts"]:
            reasons.append("context")
        result["error_candidate"] = bool(reasons)
        if reasons:
            candidates.append(
                {
                    "index": token.i,
                    "text": token.text,
                    "start": token.idx,
                    "end": token.idx + len(token.text),
                    "reasons": reasons,
                }
            )
    return results, candidates
