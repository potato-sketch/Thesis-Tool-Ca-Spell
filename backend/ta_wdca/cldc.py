"""TA-WDCA: Cross-Language Dependency Compatibility (CLDC).

Records whether the target token, its head and its dependents are Tagalog, English
or Taglish, then checks every head-dependent relation that crosses languages
against the permitted pairs in rules.py:

    CLDC(c) = valid cross-language relations / total relevant cross-language relations

A target with no cross-language relation has nothing to violate and scores 1.
"""

from error_detection.code_switching import check_code_switching
from preprocessing.lexicon import is_word, normalize
from ta_wdca.rules import is_supported

_UNJUDGED = {"unknown", "both"}


def language_label(text, lexicon):
    """"tagalog", "english", "taglish" (mixed), "both" (in both word lists) or "unknown"."""
    if not is_word(normalize(text)):
        return "unknown"
    languages = lexicon.lookup(text)
    if languages:
        return languages[0] if len(languages) == 1 else "both"

    check = check_code_switching(text, lexicon)
    if not check.valid:
        return "unknown"
    if "parts" in check.analysis:  # compound: bahay-kubo, isa-isa
        languages = {language for part in check.analysis["parts"] for language in lexicon.lookup(part)}
        return _label_from(sorted(languages), mixed="taglish")
    # Affixes are Tagalog, so an English root under them makes a Taglish word.
    return _label_from(check.analysis.get("root_languages", []), mixed="both", english_root="taglish")


def _label_from(languages, mixed, english_root=None):
    if len(languages) > 1:
        return mixed
    if languages == ["english"]:
        return english_root or "english"
    return languages[0] if languages else "unknown"


def _relations(token):
    if token.head.i != token.i:
        yield token.head, token
    for child in token.children:
        yield token, child


def cross_language_compatibility(token, lexicon):
    """Returns {"valid", "total", "score", "relations"} for the token's cross-language relations."""
    valid = total = 0
    relations = []
    for head, dependent in _relations(token):
        head_language = language_label(head.text, lexicon)
        dependent_language = language_label(dependent.text, lexicon)
        if head_language in _UNJUDGED or dependent_language in _UNJUDGED:
            continue
        if head_language == dependent_language:
            continue
        supported = is_supported(head.pos_, dependent.dep_, dependent.pos_)
        total += 1
        valid += supported
        relations.append(
            {
                "head": head.text,
                "head_language": head_language,
                "dependent": dependent.text,
                "dependent_language": dependent_language,
                "relation": dependent.dep_,
                "supported": supported,
            }
        )
    return {"valid": valid, "total": total, "score": valid / total if total else 1.0, "relations": relations}
