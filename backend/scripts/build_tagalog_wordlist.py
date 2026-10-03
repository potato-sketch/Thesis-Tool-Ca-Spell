"""PREPROCESSING MODULE: Tagalog word list.

Builds data/wordlists/tagalog.txt from Wiktionary's Tagalog entries.

Source: kaikki.org's machine-readable extract of English Wiktionary
(https://kaikki.org/dictionary/Tagalog/), CC BY-SA 4.0. This is a stand-in
until the KWF Diksiyonaryo word list is available; replacing tagalog.txt is
enough to switch sources.

Keeps each headword plus the forms Wiktionary lists for it (verb aspects such
as "kumain"/"kinain"/"kakain", alternative spellings), skipping Baybayin
spellings, multi-word expressions, Wiktionary template metadata, forms marked
dialectal/obsolete/archaic/nonstandard/misspelled (e.g. "magaaral" for
"mag-aaral"), and headwords that only exist as misspellings. Run from
the backend folder:

    .venv312\\Scripts\\python.exe scripts\\build_tagalog_wordlist.py

Pass --refresh to download the latest extract instead of the cached copy.
"""

import json
import sys
import unicodedata
import urllib.request
from datetime import date
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from preprocessing.lexicon import WORDLIST_DIR, is_word, normalize  # noqa: E402

SOURCE_URL = "https://kaikki.org/dictionary/Tagalog/kaikki.org-dictionary-Tagalog.jsonl"
DOWNLOAD_PATH = BACKEND_DIR / "data" / "raw" / "kaikki-tagalog.jsonl"
OUTPUT_PATH = WORDLIST_DIR / "tagalog.txt"

# Form "tags" that mark template bookkeeping or other scripts, not words, and
# variant spellings a checker following KWF standard spelling should not accept.
SKIP_FORM_TAGS = {
    "table-tags", "inflection-template", "Baybayin",
    "dialectal", "obsolete", "archaic", "nonstandard", "proscribed", "misspelling",
}
INVISIBLE = str.maketrans("", "", "⁠​­")  # word joiner, zero-width space, soft hyphen


def download(refresh):
    if DOWNLOAD_PATH.exists() and not refresh:
        return
    DOWNLOAD_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading {SOURCE_URL}")
    urllib.request.urlretrieve(SOURCE_URL, DOWNLOAD_PATH)


def is_latin(word):
    return all(
        unicodedata.name(char, "").startswith("LATIN") for char in word if char.isalpha()
    )


def extract_words():
    words = set()

    def add(text):
        word = normalize(text.translate(INVISIBLE))
        if is_word(word) and is_latin(word):
            words.add(word)

    with DOWNLOAD_PATH.open(encoding="utf-8") as handle:
        for line in handle:
            entry = json.loads(line)
            if entry.get("lang_code") != "tl":
                continue
            senses = entry.get("senses", [])
            if senses and all("misspelling" in sense.get("tags", []) for sense in senses):
                continue
            add(entry["word"])
            for form in entry.get("forms", []):
                if not SKIP_FORM_TAGS.intersection(form.get("tags", [])):
                    add(form["form"])
    return words


def main():
    download(refresh="--refresh" in sys.argv)
    words = extract_words()
    retrieved = date.fromtimestamp(DOWNLOAD_PATH.stat().st_mtime).isoformat()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(f"# Wiktionary Tagalog entries via kaikki.org, retrieved {retrieved}, CC BY-SA 4.0: {SOURCE_URL}\n")
        handle.writelines(f"{word}\n" for word in sorted(words))
    print(f"Wrote {len(words):,} words to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
