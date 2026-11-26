"""PREPROCESSING MODULE: English word list.

Builds data/wordlists/english.txt from the UD English Web Treebank (EWT):
https://github.com/UniversalDependencies/UD_English-EWT (CC BY-SA 4.0).
Uses all three splits (train, dev, test) at the release pinned in ud_source.py.
See ud_source.py for which tokens are kept.

Run from the backend folder:

    .venv\\Scripts\\python.exe scripts\\build_english_wordlist.py

Pass --refresh to download the files again instead of using the cached copy.
"""

import sys

from ud_source import download, extract_words, write_wordlist

TREEBANK = "UD_English-EWT"
FILES = ["en_ewt-ud-train.conllu", "en_ewt-ud-dev.conllu", "en_ewt-ud-test.conllu"]


def main():
    paths = download(TREEBANK, FILES, refresh="--refresh" in sys.argv)
    write_wordlist("english", TREEBANK, "CC BY-SA 4.0", extract_words(paths))


if __name__ == "__main__":
    main()
