import importlib.util
import sys
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR / "scripts"))

_spec = importlib.util.spec_from_file_location("import_taglish_corpus", BACKEND_DIR / "scripts" / "import_taglish_corpus.py")
corpus = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(corpus)

PROCESSED = "\n".join(
    [
        "CA-SPELL: Taglish Code-Switched Sentence Processing,,,,,,,,,",
        "Sentence ID,Respondent ID,Year Level,,Original Sentence,,Duplicate Check,Screening Status,"
        "Detected Taglish Compound Words,Dataset Partition (60/30/10)",
        "S0001,R001,4,1,Natry mo na ba?,4,Unique,Include,Natry,60% - Correct Taglish Corpus",
        "S0002,R001,4,2,Chineck ko yung chineck mo.,5,Unique,Include,Chineck,60% - Correct Taglish Corpus",
        "S0003,R001,4,3,Nag-submit na ako.,3,Unique,Include,Nag-submit,30% - Testing Data",
        "S0004,R001,4,4,I-download mo nalang.,3,Unique,Include,I-download,60% - Correct Taglish Corpus",
        "S0005,R001,4,5,I forgot na i ss wait,5,Unique,Review - Short,,60% - Correct Taglish Corpus",
        "S0006,R002,3,1,Tinry ko.,2,Unique,Include,Tinry,60% - Correct Taglish Corpus",
        "S0007,R002,3,2,x,1,Unique,Include,,60% - Correct Taglish Corpus",
        "S0008,R002,3,3,\"'Na-try mo na ba?'\",4,Unique,Include,Na-try,60% - Correct Taglish Corpus",
        "S0009,R002,3,4,Ni-reformat �yung laptop.,3,Unique,Include,Ni-reformat,60% - Correct Taglish Corpus",
        "S0010,R002,3,5,nag-PUP ako.,2,Unique,Include,nag-PUP,10% - Dev Validation",
    ]
)
VALIDATOR = "\n".join(
    [
        "Sentence ID,Screening Note,Original Taglish Sentence,Detected Compound Word(s),Linguistic Acceptability,"
        "Contextual Appropriateness,Compound Word Orthography (KWF),Validated / Gold-Standard Sentence,Validator Remarks",
        "S0002,Include,Chineck ko yung chineck mo.,,Acceptable,,,,",
        "S0003,Include,Nag-submit na ako.,,Acceptable,,,Nag-submit na ako.,",
        "S0004,Include,I-download mo nalang.,,Needs Revision,,,I-download mo na lang.,",
        "S0006,Include,Tinry ko.,,Needs Revision,,,,",
        "S0007,Include,x,,Reject,,,,",
    ]
)
COMPOUNDS = "\n".join(
    [
        "Compound Word (Normalized),,Affix / Prefix,Root Word,Morphological Pattern,Aspect / POS Trigger,"
        "KWF Orthography Status,Standardized Corpus Entry,Corpus Inclusion",
        "natry,1,na,try,,,Needs Standardization,na-try,Include in Corpus",
        "chineck,2,Infix -in-,check,,,Needs Standardization,ni-check,Include in Corpus",
        "tinry,1,Infix -in-,try,,,Needs Standardization,ni-try,Exclude",
    ]
)


class ImportTaglishCorpusTest(unittest.TestCase):
    def setUp(self):
        self.processed = list(corpus.processed_rows(PROCESSED))
        self.validations = {r["Sentence ID"]: r for r in corpus.validator_rows(VALIDATOR)}
        self.spellings = corpus.standard_spellings(COMPOUNDS)

    def build(self, validated_only=False):
        return corpus.build(self.processed, self.validations, self.spellings, validated_only)

    def test_only_the_corpus_partition_is_used(self):
        kept, _, _ = self.build()
        ids = [sentence_id for sentence_id, _, _ in kept]
        self.assertNotIn("S0003", ids)  # testing data, even though validated
        self.assertNotIn("S0010", ids)  # dev validation

    def test_gold_and_provisional_sentences(self):
        kept, skipped, problems = self.build()
        self.assertEqual(
            kept,
            [
                ("S0001", "provisional", "Na-try mo na ba?"),
                # Acceptable with no gold sentence: approved as written, so not standardized.
                ("S0002", "validated", "Chineck ko yung chineck mo."),
                ("S0004", "validated", "I-download mo na lang."),
            ],
        )
        self.assertEqual(skipped["rejected"], 1)
        self.assertEqual(skipped["needs revision, no gold sentence yet"], 1)
        self.assertEqual(skipped['screened "Review - Short"'], 1)
        self.assertEqual(skipped["duplicate"], 1)  # S0008 matches S0001 once standardized
        self.assertEqual(skipped["broken character (�)"], 1)
        self.assertEqual([sentence_id for sentence_id, _ in problems], ["S0008", "S0009"])

    def test_validated_only(self):
        kept, skipped, _ = self.build(validated_only=True)
        self.assertEqual(
            kept,
            [("S0002", "validated", "Chineck ko yung chineck mo."), ("S0004", "validated", "I-download mo na lang.")],
        )
        self.assertEqual(skipped["not validated yet"], 3)

    def test_standardize_keeps_other_words_and_case(self):
        sentence, changed = corpus.standardize("Natry mo, natry-an ko.", "Natry", {"natry": "na-try"})
        self.assertEqual((sentence, changed), ("Na-try mo, natry-an ko.", 1))

    def test_excluded_compounds_are_not_standardized(self):
        self.assertNotIn("tinry", self.spellings)

    def test_clean_normalizes_quotes_and_spaces(self):
        self.assertEqual(corpus.clean("  ‘Kay Ma’am   ako.’ "), "Kay Ma'am ako.")
        self.assertEqual(corpus.clean("'Di pa ako tapos."), "'Di pa ako tapos.")


if __name__ == "__main__":
    unittest.main()
