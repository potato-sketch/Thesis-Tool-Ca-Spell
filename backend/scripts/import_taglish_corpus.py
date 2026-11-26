"""Builds the Correct Taglish Corpus from the CA-SPELL validation sheet.

Three tabs of the sheet are read (pass a link to the sheet, or a folder holding a CSV of each tab,
named after the tab: "Processed Sentences.csv", "Validator View.csv", "Taglish Compound Corpus.csv"):

    Processed Sentences       which sentences are in the "60% - Correct Taglish Corpus" partition.
                              Only those are used: the 30% testing and 10% dev sentences must stay
                              out of the corpus, or the evaluation would be scored on data the
                              system has already seen.
    Validator View            the validators' "Linguistic Acceptability" rating and the
                              Validated / Gold-Standard Sentence.
    Taglish Compound Corpus   the standardized spelling of each compound word (rows marked
                              "Include in Corpus"), for sentences not validated yet.

Which text each corpus sentence gets:

    gold-standard sentence written       that sentence (validated)
    rated Reject                         left out
    rated Needs Revision, no gold yet    left out
    rated Acceptable, no gold sentence   the original sentence as written (validated): the
                                         validators approved it unchanged
    not rated yet                        the original sentence with its compound words replaced
                                         by their standardized spellings (provisional); left out
                                         with --validated-only, or when screened "Review - Short"

Sentences are cleaned (Unicode NFC, curly quotes to straight, surrounding quote marks and extra
spaces removed) and de-duplicated; ones with the Unicode replacement character are dropped and
reported. Writes data/corpus/correct_taglish.txt and data/corpus/correct_taglish_sources.tsv
(sentence ID and whether each line is validated or provisional). Run from the backend folder:

    python scripts/import_taglish_corpus.py "<link to the sheet, or folder of CSVs>" [--validated-only]
    python scripts/build_corpus_profile.py
"""

import argparse
import csv
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from error_correction.frequency_profile import CORPUS_DIR, CORPUS_PATH  # noqa: E402
from sheet_source import is_sheet_link, read_source, table_rows  # noqa: E402

SOURCES_PATH = CORPUS_DIR / "correct_taglish_sources.tsv"
PROCESSED_TAB, VALIDATOR_TAB, COMPOUND_TAB = "Processed Sentences", "Validator View", "Taglish Compound Corpus"

ID = "Sentence ID"
ORIGINAL, SCREENING = "Original Sentence", "Screening Status"
COMPOUNDS, PARTITION = "Detected Taglish Compound Words", "Dataset Partition (60/30/10)"
RATING, GOLD = "Linguistic Acceptability", "Validated / Gold-Standard Sentence"
WORD, ENTRY, INCLUSION = "Compound Word (Normalized)", "Standardized Corpus Entry", "Corpus Inclusion"

CORPUS_PARTITION = "60%"
ACCEPTABLE, NEEDS_REVISION, REJECT = "acceptable", "needs revision", "reject"
VALIDATED, PROVISIONAL = "validated", "provisional"

QUOTES = str.maketrans({"‘": "'", "’": "'", "“": '"', "”": '"'})


def read_tab(source, tab):
    if is_sheet_link(source):
        return read_source(source, tab=tab)
    return read_source(str(Path(source) / f"{tab}.csv"))


def processed_rows(text):
    return table_rows(text, ID, (ID, ORIGINAL, SCREENING, COMPOUNDS, PARTITION))


def validator_rows(text):
    return table_rows(text, ID, (ID, RATING, GOLD))


def standard_spellings(text):
    """Compound word (lowercased) -> its standardized spelling, for rows included in the corpus."""
    spellings = {}
    for record in table_rows(text, WORD, (WORD, ENTRY, INCLUSION)):
        entry = record[ENTRY].strip()
        if record[INCLUSION].strip().lower() == "include in corpus" and entry and "�" not in entry:
            spellings[record[WORD].strip().lower()] = entry
    return spellings


def clean(sentence):
    sentence = unicodedata.normalize("NFC", sentence).translate(QUOTES)
    sentence = " ".join(sentence.split())
    for mark in ("'", '"'):
        if len(sentence) > 1 and sentence[0] == sentence[-1] == mark:
            sentence = sentence[1:-1].strip()
    return sentence


def _match_case(original, replacement):
    if original[:1].isupper() and replacement[:1].islower():
        return replacement[0].upper() + replacement[1:]
    return replacement


def standardize(sentence, compounds, spellings):
    """Replaces each detected compound word with its standardized spelling: "Natry" -> "Na-try"."""
    changed = 0
    for word in (part.strip() for part in compounds.split(",")):
        standard = spellings.get(word.lower())
        if not word or not standard or standard == word.lower():
            continue
        pattern = re.compile(rf"(?<![\w-]){re.escape(word)}(?![\w-])", re.IGNORECASE)
        sentence, count = pattern.subn(lambda m, s=standard: _match_case(m.group(0), s), sentence)
        changed += count
    return sentence, changed


def choose(processed, validation, spellings, validated_only):
    """(sentence, VALIDATED | PROVISIONAL, None) to keep the row, or (None, None, reason) to skip it."""
    rating = validation.get(RATING, "").strip().lower()
    gold = validation.get(GOLD, "").strip()
    if rating == REJECT:
        return None, None, "rejected"
    if gold:
        return gold, VALIDATED, None
    if rating == NEEDS_REVISION:
        return None, None, "needs revision, no gold sentence yet"
    if rating == ACCEPTABLE:
        return processed[ORIGINAL], VALIDATED, None  # approved as written
    if rating:
        return None, None, f'unknown rating "{validation[RATING]}"'
    if not processed[SCREENING].strip().lower().startswith("include"):
        return None, None, f'screened "{processed[SCREENING]}"'
    if validated_only:
        return None, None, "not validated yet"
    sentence, _ = standardize(processed[ORIGINAL], processed[COMPOUNDS], spellings)
    return sentence, PROVISIONAL, None


def build(processed, validations, spellings, validated_only=False):
    """(kept [(id, kind, sentence)], skip reasons Counter, problems [(id, message)])."""
    kept, skipped, problems, seen = [], Counter(), [], {}
    for record in processed:
        if not record[PARTITION].strip().startswith(CORPUS_PARTITION):
            continue
        sentence, kind, reason = choose(record, validations.get(record[ID], {}), spellings, validated_only)
        if reason:
            skipped[reason] += 1
            continue
        sentence = clean(sentence)
        key = sentence.lower()
        if not sentence:
            skipped["empty sentence"] += 1
        elif "�" in sentence:
            skipped["broken character (�)"] += 1
            problems.append((record[ID], f"broken character: {sentence}"))
        elif key in seen:
            skipped["duplicate"] += 1
            problems.append((record[ID], f"duplicate of {seen[key]}"))
        else:
            seen[key] = record[ID]
            kept.append((record[ID], kind, sentence))
    return kept, skipped, problems


def write(kept, source_name):
    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    kinds = Counter(kind for _, kind, _ in kept)
    header = (
        f"# Correct Taglish Corpus: {len(kept)} sentences ({kinds[VALIDATED]} validated, "
        f"{kinds[PROVISIONAL]} provisional), one per line.\n"
        f"# Generated {date.today().isoformat()} by scripts/import_taglish_corpus.py from {source_name}\n"
        '# ("60% - Correct Taglish Corpus" partition). Provisional sentences are the originals with\n'
        "# standardized compound words, not yet checked by the validators. Do not edit by hand: fix the\n"
        "# sheet and import again.\n"
    )
    CORPUS_PATH.write_text(header + "".join(f"{sentence}\n" for _, _, sentence in kept), encoding="utf-8")
    with SOURCES_PATH.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, delimiter="\t", lineterminator="\n")
        writer.writerow(["sentence_id", "status", "sentence"])
        writer.writerows(kept)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", help="link to the validation sheet, or a folder with a CSV of each tab")
    parser.add_argument(
        "--validated-only", action="store_true", help="leave out sentences the validators have not approved yet"
    )
    args = parser.parse_args()

    processed = list(processed_rows(read_tab(args.source, PROCESSED_TAB)))
    validations = {r[ID]: r for r in validator_rows(read_tab(args.source, VALIDATOR_TAB))}
    spellings = standard_spellings(read_tab(args.source, COMPOUND_TAB))
    kept, skipped, problems = build(processed, validations, spellings, args.validated_only)

    partitions = Counter(r[PARTITION] or "(none)" for r in processed)
    print(f"{len(processed)} sentences in the sheet: {dict(partitions)}")
    print(f"  {len(spellings)} standardized compound spellings")
    for reason, count in skipped.most_common():
        print(f"  skipped {count}: {reason}")
    for sentence_id, message in problems:
        print(f"  {sentence_id}: {message}")

    if not kept:
        sys.exit(f"No corpus sentences to write, so {CORPUS_PATH} was not written.")
    source_name = "the validation sheet" if is_sheet_link(args.source) else Path(args.source).name
    write(kept, source_name)
    kinds = Counter(kind for _, kind, _ in kept)
    print(f"{len(kept)} sentences ({kinds[VALIDATED]} validated, {kinds[PROVISIONAL]} provisional) -> {CORPUS_PATH}")
    print("Next: python scripts/build_corpus_profile.py")


if __name__ == "__main__":
    main()
