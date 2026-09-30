"""PREPROCESSING MODULE: English word list.

Builds data/wordlists/english.txt from Open English WordNet.

Source: https://github.com/globalwordnet/english-wordnet (CC BY 4.0).
Uses the pinned release below so the word list is reproducible.

Keeps every lemma plus the irregular/inflected forms WordNet lists
(e.g. "abaci", "abetted"). WordNet does not list regular inflections, so
plurals and verb forms are generated ("files", "walked", "downloading"),
except for lemmas that have irregular forms ("child" -> "children", never
"childs"). Skips multi-word expressions ("ice cream"),
entries with digits or symbols, and all-caps acronyms ("SA", "ANG"), which
would otherwise collide with Tagalog words once lowercased.

Run from the backend folder:

    .venv312\\Scripts\\python.exe scripts\\build_english_wordlist.py
"""

import gzip
import sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from preprocessing.lexicon import WORDLIST_DIR, is_word, normalize  # noqa: E402

RELEASE = "2025-edition"
SOURCE_URL = (
    "https://github.com/globalwordnet/english-wordnet/releases/download/"
    f"{RELEASE}/english-wordnet-2025.xml.gz"
)
DOWNLOAD_PATH = BACKEND_DIR / "data" / "raw" / "english-wordnet-2025.xml.gz"
OUTPUT_PATH = WORDLIST_DIR / "english.txt"


def download():
    if DOWNLOAD_PATH.exists():
        return
    DOWNLOAD_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {SOURCE_URL}")
    urllib.request.urlretrieve(SOURCE_URL, DOWNLOAD_PATH)


VOWELS = set("aeiou")


def _plural(word):
    """Noun plural / verb third person: file -> files, box -> boxes, city -> cities."""
    if word.endswith(("s", "x", "z", "ch", "sh")):
        return word + "es"
    if word.endswith("y") and word[-2:-1] not in VOWELS:
        return word[:-1] + "ies"
    return word + "s"


def _past(word):
    """walk -> walked, save -> saved, copy -> copied."""
    if word.endswith("e"):
        return word + "d"
    if word.endswith("y") and word[-2:-1] not in VOWELS:
        return word[:-1] + "ied"
    return word + "ed"


def _gerund(word):
    """walk -> walking, save -> saving, tie -> tying, see -> seeing."""
    if word.endswith("ie"):
        return word[:-2] + "ying"
    if word.endswith("e") and not word.endswith(("ee", "ye", "oe")):
        return word[:-1] + "ing"
    return word + "ing"


def regular_inflections(lemma, part_of_speech):
    if part_of_speech == "n":
        return [_plural(lemma)]
    if part_of_speech == "v":
        return [_plural(lemma), _past(lemma), _gerund(lemma)]
    return []


def extract_words():
    words = set()

    def add(written):
        word = normalize(written)
        if is_word(word) and not written.isupper():
            words.add(word)
            return True
        return False

    with gzip.open(DOWNLOAD_PATH, "rb") as handle:
        for _, element in ET.iterparse(handle):
            if element.tag != "LexicalEntry":
                continue
            lemma = element.find("Lemma")
            written = lemma.get("writtenForm", "")
            forms = element.findall("Form")
            for form in forms:
                add(form.get("writtenForm", ""))
            # Generate regular forms only for lowercase lemmas (not "Paris") that
            # WordNet gives no irregular forms for.
            if add(written) and not forms and written[:1].islower():
                for inflection in regular_inflections(normalize(written), lemma.get("partOfSpeech")):
                    add(inflection)
            element.clear()
    return words


def main():
    download()
    words = extract_words()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(f"# Open English WordNet {RELEASE}, CC BY 4.0: {SOURCE_URL}\n")
        handle.writelines(f"{word}\n" for word in sorted(words))
    print(f"Wrote {len(words):,} words to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
