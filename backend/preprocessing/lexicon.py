"""PREPROCESSING MODULE: Linguistic Resources Preparation.

Loads the English and Tagalog word lists and keeps their automaton
representation for lookups.
"""

import logging
import re
import unicodedata
from pathlib import Path

from preprocessing.automaton import WordAutomaton

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
WORDLIST_DIR = DATA_DIR / "wordlists"
AUTOMATON_DIR = DATA_DIR / "automata"
LANGUAGES = ("english", "tagalog")

# Stress/pronunciation marks used by dictionaries (e.g. KWF's "kaín") but not in
# everyday writing. The tilde is kept because "ñ" is its own letter in Filipino.
_STRESS_MARKS = {"̀", "́", "̂"}  # grave, acute, circumflex
_APOSTROPHES = str.maketrans({"’": "'", "‘": "'", "ʼ": "'"})
_WORD = re.compile(r"[^\W\d_]+(?:['-][^\W\d_]+)*")


def normalize(word):
    """Canonical form used both when encoding word lists and when looking up tokens."""
    decomposed = unicodedata.normalize("NFD", word.translate(_APOSTROPHES).casefold())
    stripped = "".join(char for char in decomposed if char not in _STRESS_MARKS)
    return unicodedata.normalize("NFC", stripped)


def is_word(text):
    """True for single words made of letters, optionally joined by - or '."""
    return _WORD.fullmatch(text) is not None


def read_wordlist(path):
    words = set()
    with Path(path).open(encoding="utf-8") as handle:
        for line in handle:
            entry = line.strip()
            if entry and not entry.startswith("#"):
                word = normalize(entry)
                if is_word(word):
                    words.add(word)
    return words


def _load_automaton(language):
    wordlist = WORDLIST_DIR / f"{language}.txt"
    cached = AUTOMATON_DIR / f"{language}.dfa"

    if not wordlist.exists():
        logger.warning("No %s word list at %s; every lookup will miss.", language, wordlist)
        return WordAutomaton.from_words([])

    # Rebuild only when the word list changed since the automaton was encoded.
    if cached.exists() and cached.stat().st_mtime >= wordlist.stat().st_mtime:
        return WordAutomaton.load(cached)

    automaton = WordAutomaton.from_words(read_wordlist(wordlist))
    automaton.save(cached)
    logger.info("Encoded %s automaton: %s", language, automaton.stats())
    return automaton


class Lexicon:
    def __init__(self):
        self.automata = {language: _load_automaton(language) for language in LANGUAGES}

    def lookup(self, token):
        """Languages whose word list contains the token, e.g. ["tagalog"]."""
        word = normalize(token)
        return [language for language, automaton in self.automata.items() if word in automaton]

    def stats(self):
        return {language: automaton.stats() for language, automaton in self.automata.items()}
