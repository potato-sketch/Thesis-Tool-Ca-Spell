"""PREPROCESSING MODULE: word lists from Universal Dependencies treebanks.

Shared by build_english_wordlist.py and build_tagalog_wordlist.py. Downloads the
CoNLL-U files of one treebank at a pinned release (so the word lists are
reproducible) and collects the words written in it:

- every word form and its lemma, lowercased ("Went" -> "went", "go");
- multi-word tokens as written ("don't", "I'm", Tagalog "akong", "isang"), since
  that is how people type them; their parts ("do", "n't") are words of their own;
- nothing UD marks as misspelled (Typo=Yes in FEATS or CorrectForm= in MISC, e.g.
  EWT's "targetting"), nor word fragments split across tokens (deprel goeswith);
- no punctuation, symbols, numbers or "other" (X) tokens such as e-mail addresses;
- no all-caps tokens longer than one letter (acronyms such as "SA", "ANG"), which
  would otherwise collide with Tagalog words once lowercased.
"""

import sys
import urllib.request
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from preprocessing.lexicon import WORDLIST_DIR, is_word, normalize  # noqa: E402

RELEASE = "r2.19"
RAW_DIR = BACKEND_DIR / "data" / "raw" / "ud"
SKIP_UPOS = {"PUNCT", "SYM", "NUM", "X"}


def repository_url(treebank):
    return f"https://github.com/UniversalDependencies/{treebank}"


def download(treebank, files, refresh=False):
    """Fetch the treebank's .conllu files at RELEASE into data/raw/ud/<treebank>/."""
    target = RAW_DIR / treebank / RELEASE
    target.mkdir(parents=True, exist_ok=True)
    paths = []
    for name in files:
        path = target / name
        if refresh or not path.exists():
            url = f"https://raw.githubusercontent.com/UniversalDependencies/{treebank}/{RELEASE}/{name}"
            print(f"Downloading {url}")
            urllib.request.urlretrieve(url, path)
        paths.append(path)
    return paths


def _is_typo(feats, misc):
    return "Typo=Yes" in feats.split("|") or any(item.startswith("CorrectForm=") for item in misc.split("|"))


def _sentences(path):
    """Yield each sentence as a list of its 10-column token lines."""
    rows = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.rstrip("\n")
            if not line:
                if rows:
                    yield rows
                rows = []
            elif not line.startswith("#"):
                columns = line.split("\t")
                if len(columns) == 10:
                    rows.append(columns)
    if rows:
        yield rows


def extract_words(paths):
    words = set()

    def add(text):
        if len(text) > 1 and text.isupper():
            return
        word = normalize(text)
        if is_word(word):
            words.add(word)

    for path in paths:
        for rows in _sentences(path):
            # Ids of misspelled words and of both halves of a split word ("any" + "more" goeswith);
            # a multi-word token that contains one is skipped too.
            bad = set()
            for token_id, _, _, _, _, feats, head, deprel, _, misc in rows:
                if token_id.isdigit():
                    if _is_typo(feats, misc):
                        bad.add(token_id)
                    elif deprel == "goeswith":
                        bad.update({token_id, head})
            for token_id, form, lemma, upos, *_, misc in rows:
                if token_id.isdigit():
                    if token_id not in bad and upos not in SKIP_UPOS:
                        add(form)
                        if lemma != "_":
                            add(lemma)
                elif "-" in token_id and not _is_typo("", misc):
                    start, end = (int(part) for part in token_id.split("-"))
                    if not bad.intersection(str(i) for i in range(start, end + 1)):
                        add(form)
    return words


def write_wordlist(language, treebank, license_name, words):
    output = WORDLIST_DIR / f"{language}.txt"
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(f"# Universal Dependencies {treebank} {RELEASE}, {license_name}: {repository_url(treebank)}\n")
        handle.writelines(f"{word}\n" for word in sorted(words))
    print(f"Wrote {len(words):,} words to {output}")
