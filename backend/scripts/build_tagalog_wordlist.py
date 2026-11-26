"""PREPROCESSING MODULE: Tagalog word list.

Builds data/wordlists/tagalog.txt from the UD Tagalog Ugnayan treebank:
https://github.com/UniversalDependencies/UD_Tagalog-Ugnayan (CC BY-NC-SA 4.0).
Ugnayan has a single test split, used whole, at the release pinned in
ud_source.py. See ud_source.py for which tokens are kept.

Run from the backend folder:

    .venv\\Scripts\\python.exe scripts\\build_tagalog_wordlist.py

Pass --refresh to download the file again instead of using the cached copy.
"""

import sys

from ud_source import download, extract_words, write_wordlist

TREEBANK = "UD_Tagalog-Ugnayan"
FILES = ["tl_ugnayan-ud-test.conllu"]


def main():
    paths = download(TREEBANK, FILES, refresh="--refresh" in sys.argv)
    write_wordlist("tagalog", TREEBANK, "CC BY-NC-SA 4.0", extract_words(paths))


if __name__ == "__main__":
    main()
