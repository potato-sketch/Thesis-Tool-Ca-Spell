import random
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from preprocessing.automaton import WordAutomaton  # noqa: E402
from preprocessing.lexicon import normalize  # noqa: E402


def right_language(automaton, state, memo):
    """All suffixes accepted from a state (only feasible for tiny automata)."""
    if state not in memo:
        suffixes = [""] if automaton.finals[state] else []
        for char, target in automaton.transitions[state].items():
            suffixes.extend(char + rest for rest in right_language(automaton, target, memo))
        memo[state] = frozenset(suffixes)
    return memo[state]


class WordAutomatonTest(unittest.TestCase):
    def test_accepts_exactly_the_word_list(self):
        words = {"bahay", "bahayan", "kain", "kumain", "kainan", "cat", "cats", "car"}
        automaton = WordAutomaton.from_words(words)

        self.assertEqual(list(automaton), sorted(words))
        for word in words:
            self.assertIn(word, automaton)
        for non_word in ["", "b", "baha", "bahays", "kaina", "ca", "dog"]:
            self.assertNotIn(non_word, automaton)

    def test_is_minimal_on_random_word_lists(self):
        # A trimmed acyclic DFA is minimal iff no two states accept the same suffixes.
        rng = random.Random(0)
        for _ in range(500):
            words = {
                "".join(rng.choice("abc") for _ in range(rng.randint(1, 6)))
                for _ in range(rng.randint(1, 40))
            }
            automaton = WordAutomaton.from_words(words)
            memo = {}
            languages = [right_language(automaton, s, memo) for s in range(automaton.state_count)]
            self.assertEqual(len(set(languages)), len(languages), words)
            self.assertEqual(set(automaton), words)

    def test_shares_common_suffixes(self):
        # "kumain"/"kinain" end in "ain"; a trie needs a separate path per word.
        automaton = WordAutomaton.from_words(["kumain", "kinain", "tumakbo", "tinakbo"])
        self.assertLess(automaton.state_count, 1 + len("kumain" "inain" "tumakbo" "inakbo"))

    def test_empty_word_list(self):
        automaton = WordAutomaton.from_words([])
        self.assertEqual(len(automaton), 0)
        self.assertNotIn("a", automaton)

    def test_save_and_load_round_trip(self):
        automaton = WordAutomaton.from_words(["isa", "dalawa", "tatlo"])
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "words.dfa"
            automaton.save(path)
            loaded = WordAutomaton.load(path)
        self.assertEqual(list(loaded), list(automaton))
        self.assertEqual(loaded.stats(), automaton.stats())


class NormalizeTest(unittest.TestCase):
    def test_strips_dictionary_stress_marks_but_keeps_enye(self):
        self.assertEqual(normalize("Kaín"), "kain")
        self.assertEqual(normalize("bahâ"), "baha")
        self.assertEqual(normalize("Niño"), "niño")

    def test_unifies_apostrophes(self):
        self.assertEqual(normalize("o’clock"), "o'clock")


if __name__ == "__main__":
    unittest.main()
