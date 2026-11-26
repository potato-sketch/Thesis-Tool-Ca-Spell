"""The KWF Manwal sa Masinop na Pagsulat hyphen rules, checked against the Manwal's own examples
(sections 2.3, 11.1, 11.3, 11.9, 11.10 and 12.40)."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from error_detection.code_switching import check_code_switching  # noqa: E402
from preprocessing.lexicon import normalize  # noqa: E402


class KwfLexicon:
    ENGLISH = {"cute", "cremate", "computer", "shake", "makeup", "blessing", "close", "share", "submit", "check"}
    TAGALOG = {
        "aral", "isa", "ulo", "hilaga", "lungsod", "lupa", "kyut", "krimeyt", "kompiyuter", "kain",
        "ano", "araw", "palito", "balik", "baligtad", "wasak", "suntok", "pareho", "lata", "kahon",
        "hipo", "mano", "law", "iba", "sari",
    }

    def lookup(self, word):
        word = normalize(word)
        return [lang for lang, words in (("english", self.ENGLISH), ("tagalog", self.TAGALOG)) if word in words]


def check(word):
    return check_code_switching(word, KwfLexicon())


class Kwf11_3ConsonantAndVowelTest(unittest.TestCase):
    def test_hyphen_between_consonant_and_vowel(self):
        for word in ["pag-isa", "mag-aral", "pang-ulo"]:
            self.assertTrue(check(word).valid, word)

    def test_missing_hyphen_before_vowel(self):
        self.assertEqual(check("pagisa").expected, "pag-isa")


class Kwf11_3ForeignWordsAndProperNounsTest(unittest.TestCase):
    def test_foreign_word_in_original_spelling_takes_a_hyphen(self):
        for word in ["pa-cute", "ipa-cremate", "maki-computer", "mag-shake", "nag-makeup"]:
            self.assertTrue(check(word).valid, word)

    def test_missing_hyphen_before_foreign_word(self):
        for word, expected in [("pacute", "pa-cute"), ("makicomputer", "maki-computer")]:
            result = check(word)
            self.assertEqual(result.error_type, "hyphenation", word)
            self.assertEqual(result.expected, expected)

    def test_respelled_word_has_no_hyphen(self):
        for word in ["pakyut", "ipakrimeyt", "makikompiyuter", "pahilaga", "makalupa"]:
            self.assertTrue(check(word).valid, word)
        self.assertEqual(check("pa-kyut").expected, "pakyut")

    def test_proper_noun_not_in_the_word_lists(self):
        for word in ["pa-Mandaluyong", "taga-Itogon", "naka-Gucci"]:
            result = check(word)
            self.assertTrue(result.valid, word)
            self.assertEqual(result.analysis["kwf_rule"], "H2")

    def test_lowercase_unknown_root_is_still_a_misspelling(self):
        result = check("naka-guccci")
        self.assertFalse(result.valid)
        self.assertEqual(result.error_part, "root")


class Kwf2_3RepeatedSyllableTest(unittest.TestCase):
    def test_first_consonant_and_vowel_of_a_cluster_repeat(self):
        for word in ["magbe-blessing", "ipako-close", "ise-share"]:
            self.assertTrue(check(word).valid, word)


class Kwf11_1RepeatedWordsTest(unittest.TestCase):
    def test_repeated_words(self):
        for word in ["ano-ano", "araw-araw", "pare-pareho", "pali-palito", "bali-baligtad"]:
            self.assertTrue(check(word).valid, word)

    def test_prefix_joins_the_first_half(self):
        for word in ["pabalik-balik", "nagkawasak-wasak"]:
            result = check(word)
            self.assertTrue(result.valid, word)
            self.assertEqual(result.analysis["kwf_rule"], "H4")

    def test_o_becomes_u_before_a_suffix(self):
        self.assertTrue(check("suntok-suntukan").valid)

    def test_one_syllable_is_not_a_repeated_word(self):
        self.assertFalse(check("pa-palito").valid)

    def test_contraction_is_not_a_repeated_word(self):
        for word, expected in [("iba't-iba", "iba't iba"), ("samo't-sari", "samo't sari"), ("Iba't-iba", "Iba't iba")]:
            result = check(word)
            self.assertEqual(result.error_type, "hyphenation", word)
            self.assertEqual(result.expected, expected)


class Kwf11_9And11_10HyphenOnlyPrefixesTest(unittest.TestCase):
    def test_de_di_and_kontra_take_a_hyphen(self):
        for word in ["de-lata", "de-kahon", "de-mano", "di-mahipo", "kontra-Marxismo"]:
            result = check(word)
            self.assertTrue(result.valid, word)
            self.assertEqual(result.analysis["kwf_rule"], "H5")

    def test_not_read_inside_unhyphenated_words(self):
        result = check("dilaw")  # not di- + law
        self.assertFalse(result.valid)
        self.assertNotEqual(result.error_type, "hyphenation")

    def test_misspelled_word_after_de(self):
        self.assertFalse(check("de-latta").valid)


if __name__ == "__main__":
    unittest.main()
