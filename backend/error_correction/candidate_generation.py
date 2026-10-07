"""ERROR CORRECTION MODULE: Candidate generation.

Collects every valid word of the English and Tagalog word lists that is within
the edit distance threshold of the misspelled word. Nothing is decided here: the
candidates still have to be ranked by context.
"""

from dataclasses import dataclass

from error_correction.edit_distance import search
from preprocessing.lexicon import normalize

# Candidates sent on to context ranking, closest first. Every one costs a parse.
MAX_CANDIDATES = 30


@dataclass(frozen=True)
class Candidate:
    word: str
    distance: int
    languages: tuple = ()


def generate_candidates(word, automata, limit=MAX_CANDIDATES):
    """`automata` maps a language name to its word-list automaton."""
    target = normalize(word)
    found = {}
    for language, automaton in automata.items():
        for candidate, distance in search(automaton, target).items():
            if distance == 0:
                continue
            _, languages = found.get(candidate, (distance, ()))
            found[candidate] = (distance, languages + (language,))

    candidates = [Candidate(word, distance, languages) for word, (distance, languages) in found.items()]
    # Closest first; then words that keep the first letter, which is rarely the typo.
    candidates.sort(key=lambda c: (c.distance, c.word[:1] != target[:1], abs(len(c.word) - len(target)), c.word))
    return candidates[:limit]
