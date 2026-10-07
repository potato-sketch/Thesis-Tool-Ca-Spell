import sys
import unittest
from pathlib import Path

from spacy.tokens import Doc
from spacy.vocab import Vocab

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from error_detection.annotation import annotate  # noqa: E402
from error_detection.code_switching import check_code_switching  # noqa: E402
from error_detection.compatibility import check_compatibility  # noqa: E402
from error_detection.detector import detect_errors  # noqa: E402
from preprocessing.lexicon import normalize  # noqa: E402


class FakeLexicon:
    ENGLISH = {"submit", "download", "save", "attend", "comment", "report", "project", "nag", "at"}
    TAGALOG = {
        "kain", "aral", "aaral", "luto", "ganda", "anda", "bahay", "kubo", "isa", "araw",
        "maynila", "nga", "ako", "kami", "sa", "ng", "ang", "bukas", "kahapon", "mamaya",
        "ngayon", "kanina", "nag", "amin", "maganda", "siya",
    }

    def lookup(self, word):
        word = normalize(word)
        return [lang for lang, words in (("english", self.ENGLISH), ("tagalog", self.TAGALOG)) if word in words]


LEXICON = FakeLexicon()


def check(word):
    return check_code_switching(word, LEXICON)


class HyphenBasedSplittingTest(unittest.TestCase):
    def test_valid_taglish_words(self):
        for word in ["nag-submit", "magsu-submit", "nagdo-download", "nag-a-attend", "i-save", "comment-an"]:
            self.assertTrue(check(word).valid, word)

    def test_h1_hyphen_after_consonant_prefix_before_vowel(self):
        self.assertTrue(check("mag-aral").valid)
        self.assertTrue(check("mag-aaral").valid)

    def test_compounds_and_repeated_words(self):
        for word in ["bahay-kubo", "isa-isa", "araw-araw"]:
            result = check(word)
            self.assertTrue(result.valid, word)
            self.assertEqual(result.method, "compound")

    def test_proper_noun_root(self):
        self.assertTrue(check("taga-Maynila").valid)

    def test_misspelled_root(self):
        for word, root in [("na-strwss", "strwss"), ("ma-detete", "detete"), ("commrnt-an", "commrnt")]:
            result = check(word)
            self.assertFalse(result.valid)
            self.assertEqual(result.error_part, "root", word)
            self.assertEqual(result.analysis["root"], root)

    def test_misspelled_affix(self):
        for word in ["nagg-submit", "nga-submit"]:
            result = check(word)
            self.assertFalse(result.valid, word)
            self.assertEqual(result.error_part, "affix", word)

    def test_h3_unnecessary_hyphen_before_tagalog_root(self):
        result = check("nag-kain")
        self.assertEqual(result.error_type, "hyphenation")
        self.assertEqual(result.expected, "nagkain")


class AffixBoundaryDetectionTest(unittest.TestCase):
    def test_valid_tagalog_affixation(self):
        for word, analysis in [
            ("nagluto", {"prefix": "nag", "root": "luto"}),
            ("kumain", {"infix": "um", "root": "kain"}),
            ("kakain", {"reduplication": "ka", "root": "kain"}),
        ]:
            result = check(word)
            self.assertTrue(result.valid, word)
            for key, value in analysis.items():
                self.assertEqual(result.analysis[key], value, word)

    def test_h2_missing_hyphen_before_english_root(self):
        for word, expected in [
            ("nagsubmit", "nag-submit"),
            ("magsusubmit", "magsu-submit"),
            ("isave", "i-save"),
        ]:
            result = check(word)
            self.assertEqual(result.error_type, "hyphenation", word)
            self.assertEqual(result.expected, expected)

    def test_h1_missing_hyphen_before_vowel(self):
        self.assertEqual(check("magaral").expected, "mag-aral")

    def test_h2_proper_noun_keeps_capital(self):
        self.assertEqual(check("tagaMaynila").expected, "taga-Maynila")

    def test_misspelled_root(self):
        for word, root in [("nastrwss", "strwss"), ("madetete", "detete"), ("commrntan", "commrnt")]:
            result = check(word)
            self.assertEqual(result.error_part, "root", word)
            self.assertEqual(result.analysis["root"], root)

    def test_misspelled_affix(self):
        result = check("naggsubmit")
        self.assertEqual(result.error_part, "affix")
        self.assertEqual(result.analysis["root"], "submit")

    def test_unanalyzable_word(self):
        self.assertEqual(check("xyzzyq").error_part, "word")


class LinkerTest(unittest.TestCase):
    def test_linker_and_contractions_attach_to_valid_words(self):
        for word, base in [
            ("magandang", "maganda"),  # vowel-final + ng
            ("aming", "amin"),  # n-final + g
            ("ako'y", "ako"),
            ("siya't", "siya"),
        ]:
            result = check(word)
            self.assertTrue(result.valid, word)
            self.assertEqual(result.analysis["base"], base)

    def test_linker_on_affixed_taglish_word(self):
        result = check("nag-submit't")
        self.assertTrue(result.valid)
        self.assertEqual(result.analysis["root"], "submit")

    def test_linker_does_not_rescue_misspellings(self):
        for word in ["bahayng", "strwssng"]:
            self.assertFalse(check(word).valid, word)


def parse(words, pos, heads, deps, morphs=None):
    return Doc(
        Vocab(), words=words, pos=pos, heads=heads, deps=deps,
        morphs=morphs or [""] * len(words),
    )


class ContextTest(unittest.TestCase):
    def test_table_3_annotations(self):
        doc = parse(
            ["Nag-submit", "ako", "bukas", "."],
            ["VERB", "PRON", "ADV", "PUNCT"], [0, 0, 0, 0], ["ROOT", "nsubj", "advmod", "punct"],
        )
        self.assertEqual(annotate(doc[0], LEXICON)["annotation"], "VERB-PAST")
        self.assertEqual(annotate(doc[2], LEXICON)["annotation"], "ADV-FUTURE")

    def test_prefix_comes_from_affix_analysis(self):
        # "maganda" is ma- + ganda, not mag- + anda.
        doc = parse(["Maganda"], ["VERB"], [0], ["ROOT"])
        self.assertIsNone(annotate(doc[0], LEXICON))

    def test_bukas_meaning_open_is_not_temporal(self):
        doc = parse(["Bukas", "ang", "pinto"], ["NOUN", "DET", "NOUN"], [0, 2, 0], ["ROOT", "det", "nsubj"])
        self.assertIsNone(annotate(doc[0], LEXICON))

    def test_calamancy_aspect_for_verbs_without_nag_mag(self):
        doc = parse(["Kumain"], ["VERB"], [0], ["ROOT"], ["Aspect=Perf|Mood=Ind"])
        self.assertEqual(annotate(doc[0], LEXICON)["annotation"], "VERB-PAST")

    def test_table_4_past_verb_with_future_time_is_incompatible(self):
        doc = parse(
            ["Nag-submit", "ako", "bukas", "."],
            ["VERB", "PRON", "ADV", "PUNCT"], [0, 0, 0, 0], ["ROOT", "nsubj", "advmod", "punct"],
        )
        _, errors = detect_errors(doc, LEXICON)
        self.assertEqual([(e["text"], e["reasons"]) for e in errors], [("Nag-submit", ["context"])])

    def test_table_4_compatible_pairs_pass(self):
        doc = parse(
            ["Nag-submit", "ako", "kahapon"],
            ["VERB", "PRON", "ADV"], [0, 0, 0], ["ROOT", "nsubj", "advmod"],
        )
        _, errors = detect_errors(doc, LEXICON)
        self.assertEqual(errors, [])

    def test_time_word_attached_below_the_verb(self):
        # "mamaya" hangs off "project", which hangs off the verb.
        doc = parse(
            ["Magsu-submit", "ako", "ng", "project", "kahapon"],
            ["VERB", "PRON", "ADP", "NOUN", "ADV"], [0, 0, 3, 0, 3],
            ["ROOT", "nsubj", "case", "obj", "advmod"],
        )
        annotations = {t.i: a for t in doc if (a := annotate(t, LEXICON))}
        self.assertIn(0, check_compatibility(doc, annotations))


if __name__ == "__main__":
    unittest.main()
