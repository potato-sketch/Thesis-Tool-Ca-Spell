"""ERROR DETECTION MODULE: Code-switching & compound word checking.

Runs on tokens that failed the dictionary look-up. Decides whether the token is
a legitimate affixed (Tagalog or Taglish) or compound word, and if not, which
part holds the error so the Error Correction Module knows what to fix:

  Hyphen-based splitting     tokens with a hyphen: "na-strwss", "commrnt-an"
  Affix boundary detection   tokens without one:   "nastrwss", "commrntan"
"""

from dataclasses import dataclass, field

from error_detection.morphology import (
    PREFIXES,
    SUFFIXES,
    MIN_ROOT_LENGTH,
    hyphen_positions,
    hyphen_rules,
    is_affix_chunk,
    is_misspelled_prefix,
    linker_bases,
    readings,
    with_hyphens,
)
from preprocessing.lexicon import normalize


@dataclass
class WordCheck:
    valid: bool
    method: str  # "dictionary", "compound", "hyphen_splitting", "affix_boundary"
    error_type: str | None = None  # "spelling" or "hyphenation"
    error_part: str | None = None  # "word", "root" or "affix"
    analysis: dict = field(default_factory=dict)
    expected: str | None = None  # correctly hyphenated form, for hyphenation errors

    def as_dict(self):
        return {
            "valid": self.valid,
            "method": self.method,
            "error_type": self.error_type,
            "error_part": self.error_part,
            "analysis": self.analysis,
            "expected": self.expected,
        }


def check_code_switching(text, lexicon):
    result = _check(text, lexicon)
    if result.valid:
        return result

    # Linker -ng and contractions 'y/'t attach to any word ("magandang",
    # "aming", "ako'y"), so the word lists rarely contain these forms.
    for base in linker_bases(text):
        if lexicon.lookup(base):
            return WordCheck(True, "dictionary", analysis={"base": base, "linker": text[len(base):]})
        base_result = _check(base, lexicon)
        if base_result.valid:
            base_result.analysis = {**base_result.analysis, "linker": text[len(base):]}
            return base_result
    return result


def _check(text, lexicon):
    if "-" in text:
        return hyphen_based_splitting(text, lexicon)
    return affix_boundary_detection(text, lexicon)


def hyphen_based_splitting(text, lexicon):
    parts = text.split("-")

    result = _best_segmentation(text, lexicon, method="hyphen_splitting")
    if result and result.valid:
        return result

    # Compounds and reduplicated words: "bahay-kubo", "isa-isa", "araw-araw".
    # Not when the first part is a prefix or one edit from a prefix: "nag-kain" is
    # an affixed word with an unnecessary hyphen and "nga-submit" a misspelled
    # "nag-submit", even though "nag" and "nga" are also in the word lists.
    if all(lexicon.lookup(part) for part in parts):
        first = normalize(parts[0])
        repeated = len({normalize(part) for part in parts}) == 1
        if repeated or not (first in PREFIXES or is_misspelled_prefix(first)):
            return WordCheck(valid=True, method="compound", analysis={"parts": parts})

    if result:
        return result

    # No valid reading: use the hyphens to tell affix from root.
    # "na-strwss" -> affix "na", root "strwss"; "commrnt-an" -> root "commrnt", suffix "an".
    suffix = ""
    if normalize(parts[-1]) in SUFFIXES:
        suffix, parts = parts[-1], parts[:-1]
    root, affix = parts[-1], "-".join(parts[:-1])
    analysis = {"affix": affix, "root": root, "suffix": suffix}

    root_known = bool(lexicon.lookup(root))
    affix_ok = is_affix_chunk(normalize(affix)) if affix else True
    if root_known and is_misspelled_prefix(normalize(affix)):
        error_part = "affix"  # "nagg-submit"
    elif affix_ok and not root_known:
        error_part = "root"  # "na-strwss", "ma-detete", "commrnt-an"
    else:
        error_part = "word"
    return WordCheck(False, "hyphen_splitting", "spelling", error_part, analysis)


def affix_boundary_detection(text, lexicon):
    result = _best_segmentation(text, lexicon, method="affix_boundary")
    if result:
        return result

    word = normalize(text)

    # Known word after a near-miss prefix: the affix is misspelled ("naggsubmit").
    for cut in range(1, min(8, len(word) - MIN_ROOT_LENGTH) + 1):
        chunk, rest = word[:cut], word[cut:]
        if lexicon.lookup(rest) and is_misspelled_prefix(chunk):
            return WordCheck(
                False, "affix_boundary", "spelling", "affix",
                {"affix": text[:cut], "root": text[cut:], "suffix": ""},
            )

    # Valid affixes around an unknown root: the root is misspelled ("nastrwss", "commrntan").
    best = None
    for prefix in ("",) + PREFIXES:
        for suffix in ("",) + SUFFIXES:
            if not (prefix or suffix):
                continue
            if not (word.startswith(prefix) and word.endswith(suffix)):
                continue
            root_end = len(word) - len(suffix)
            if root_end - len(prefix) < MIN_ROOT_LENGTH:
                continue
            affix_length = len(prefix) + len(suffix)
            if best is None or affix_length > best[0]:
                best = (affix_length, prefix, suffix, root_end)
    if best:
        _, prefix, suffix, root_end = best
        return WordCheck(
            False, "affix_boundary", "spelling", "root",
            {
                "affix": text[: len(prefix)],
                "root": text[len(prefix) : root_end],
                "suffix": text[root_end:],
            },
        )

    return WordCheck(False, "affix_boundary", "spelling", "word")


def _best_segmentation(text, lexicon, method):
    """Pick the affixed reading that best fits the hyphens the writer used."""
    letters = text.replace("-", "")
    hyphens = hyphen_positions(text)

    best = None
    for segmentation in readings(text, lexicon.lookup):
        proper_noun = letters[segmentation.root_start : segmentation.root_start + 1].isupper()
        required, optional = hyphen_rules(segmentation, proper_noun_root=proper_noun)
        missing = required - hyphens
        extra = hyphens - required - optional
        rank = (len(missing) + len(extra), -len(segmentation.root))
        if best is None or rank < best[0]:
            best = (rank, segmentation, missing, extra, required, optional)

    if best is None:
        return None
    _, segmentation, missing, extra, required, optional = best
    if not (missing or extra):
        return WordCheck(True, method, analysis=segmentation.as_dict())
    expected = with_hyphens(letters, required | (hyphens & optional))
    return WordCheck(
        False, method, "hyphenation", "affix", segmentation.as_dict(), expected=expected
    )
