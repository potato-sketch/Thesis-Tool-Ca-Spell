"""TA-WDCA: Cross-Language Dependency Compatibility (CLDC).

Records whether the target token, its head and its dependents are Tagalog, English
or Taglish, then checks every head-dependent relation that crosses languages
against the cross-language relations found in the Correct Taglish Corpus (or, when
no corpus profile is loaded, the permitted pairs in rules.py):

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


def relation_pattern(head, dependent):
    """"HEAD-POS|relation|DEPENDENT-POS", the base relation without its subtype: "VERB|obj|NOUN"."""
    return f"{head.pos_}|{dependent.dep_.split(':')[0].lower()}|{dependent.pos_}"


def cross_language_pair(head, dependent, lexicon):
    """(head language, dependent language) when the relation crosses languages, else None."""
    head_language = language_label(head.text, lexicon)
    dependent_language = language_label(dependent.text, lexicon)
    if head_language in _UNJUDGED or dependent_language in _UNJUDGED or head_language == dependent_language:
        return None
    return head_language, dependent_language


def cross_language_patterns(doc, lexicon):
    """Patterns of every cross-language relation in a sentence, for the corpus frequency profile."""
    patterns = []
    for token in doc:
        if token.head.i != token.i and cross_language_pair(token.head, token, lexicon):
            patterns.append(relation_pattern(token.head, token))
    return patterns


def cross_language_compatibility(token, lexicon, profile=None):
    """Returns {"valid", "total", "score", "source", "relations"} for the token's cross-language relations.

    A relation is valid when its pattern occurs in the Correct Taglish Corpus (the profile's
    cross-language patterns). Without a corpus profile the permitted pairs in rules.py are used.
    """
    corpus = profile.cross_language_patterns if profile is not None else None
    valid = total = 0
    relations = []
    for head, dependent in _relations(token):
        languages = cross_language_pair(head, dependent, lexicon)
        if languages is None:
            continue
        head_language, dependent_language = languages
        if corpus is not None:
            supported = corpus.get(relation_pattern(head, dependent), 0) > 0
        else:
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
    return {
        "valid": valid,
        "total": total,
        "score": valid / total if total else 1.0,
        "source": "corpus" if corpus is not None else "rules",
        "relations": relations,
    }
