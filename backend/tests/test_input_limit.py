import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from preprocessing.input_limit import MAX_WORDS, check_word_limit, count_words  # noqa: E402


class InputLimitTest(unittest.TestCase):
    def test_limit_is_500_words(self):
        self.assertEqual(MAX_WORDS, 500)

    def test_counts_words_between_whitespace(self):
        self.assertEqual(count_words("  Nag-submit ako\tng\nassignment.  "), 4)
        self.assertEqual(count_words(""), 0)

    def test_accepts_up_to_the_limit(self):
        text = " ".join(["salita"] * MAX_WORDS)
        self.assertEqual(check_word_limit(text), text)

    def test_rejects_more_than_the_limit(self):
        with self.assertRaisesRegex(ValueError, "up to 500 words at a time; this text has 501"):
            check_word_limit(" ".join(["salita"] * (MAX_WORDS + 1)))


if __name__ == "__main__":
    unittest.main()
