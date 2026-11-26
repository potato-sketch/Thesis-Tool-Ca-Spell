import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "scripts"))

import sheet_source  # noqa: E402
from preprocessing import lexicon as lexicon_module  # noqa: E402


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, BACKEND_DIR / "scripts" / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


compounds = load_script("import_taglish_compounds")

SHEET = "\n".join(
    [
        "CA-Spell: Taglish Compound Corpus & Frequency Directory,,,,,,,,",
        "Total Unique Compounds,,Total Occurrences,,,,,,",
        "Compound Word (Normalized),,Affix / Prefix,Root Word,Morphological Pattern,Aspect / POS Trigger,"
        "KWF Orthography Status,Standardized Corpus Entry,Corpus Inclusion",
        "nag-download,6,nag,download,,,Standard (KWF-Compliant),nag-download,Include in Corpus",
        "chineck,2,Infix -in-,check,,,Needs Standardization,ni-check,Include in Corpus",
        "Nagcheck,1,nag,check,,,Needs Standardization,Nag-check,Include in Corpus",
        "nagcheck,1,nag,check,,,Needs Standardization,nag-check,Include in Corpus",
        "na-404,1,na,404,,,Standard (KWF-Compliant),na-404,Include in Corpus",
        "binack,1,Infix -in-,binack,,,Non-Standard / Informal,�,Exclude",
        "na-sabaw,1,na,sabaw,,,Non-Standard / Informal,,Include in Corpus",
    ]
)


class ImportTaglishCompoundsTest(unittest.TestCase):
    def test_keeps_included_standardized_entries(self):
        words, skipped, problems = compounds.build(compounds.compound_rows(SHEET))
        self.assertEqual(words, ["nag-check", "nag-download", "ni-check"])
        self.assertEqual(skipped["not included"], 1)
        self.assertEqual(skipped["duplicate"], 1)
        self.assertEqual(skipped["not a word of letters"], 1)
        self.assertEqual(skipped["no standardized entry"], 1)
        self.assertEqual([word for word, _ in problems], ["na-404", "na-sabaw"])

    def test_missing_column_is_an_error(self):
        with self.assertRaises(ValueError):
            list(compounds.compound_rows("Compound Word (Normalized),Corpus Inclusion\nx,Include in Corpus\n"))


class SheetSourceTest(unittest.TestCase):
    LINK = "https://docs.google.com/spreadsheets/d/abc-123/edit?gid=42#gid=42"

    def test_export_url_uses_the_links_tab(self):
        self.assertEqual(
            sheet_source.export_url(self.LINK),
            "https://docs.google.com/spreadsheets/d/abc-123/export?format=csv&gid=42",
        )

    def test_export_url_by_tab_name(self):
        self.assertEqual(
            sheet_source.export_url(self.LINK, tab="Taglish Compound Corpus"),
            "https://docs.google.com/spreadsheets/d/abc-123/gviz/tq?tqx=out%3Acsv&sheet=Taglish+Compound+Corpus",
        )


class TaglishWordListTest(unittest.TestCase):
    def test_lexicon_finds_listed_compounds_and_tolerates_a_missing_list(self):
        with tempfile.TemporaryDirectory() as directory:
            wordlists, automata = Path(directory) / "wordlists", Path(directory) / "automata"
            wordlists.mkdir()
            automata.mkdir()
            (wordlists / "english.txt").write_text("check\n", encoding="utf-8")
            (wordlists / "tagalog.txt").write_text("bahay\n", encoding="utf-8")
            with mock.patch.multiple(lexicon_module, WORDLIST_DIR=wordlists, AUTOMATON_DIR=automata):
                self.assertEqual(lexicon_module.Lexicon().lookup("ni-check"), [])

                (wordlists / "taglish.txt").write_text("# comment\nni-check\n", encoding="utf-8")
                lexicon = lexicon_module.Lexicon()
                self.assertEqual(lexicon.lookup("Ni-check"), ["taglish"])
                self.assertEqual(lexicon.lookup("bahay"), ["tagalog"])


if __name__ == "__main__":
    unittest.main()
