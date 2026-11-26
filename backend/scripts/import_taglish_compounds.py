"""PREPROCESSING MODULE: Taglish compound word list.

Builds data/wordlists/taglish.txt from the "Taglish Compound Corpus" tab of the CA-SPELL validation
sheet. Run it after the validators have reviewed that tab: every row marked "Include in Corpus" is
taken as a correct, KWF-standard Taglish word.

The Lexicon loads taglish.txt beside english.txt and tagalog.txt, so a listed word such as
"ni-check" is accepted even when the affix rules in error_detection/morphology.py would reject it,
and becomes a correction candidate for misspellings of it. Taken from each included row:

    Standardized Corpus Entry   the word itself (rows with an empty or broken entry are skipped)

Entries that are not a single word of letters (na-404, nag-1) are skipped. Before writing, each
entry is also checked with CA-Spell's own affix and hyphen rules, and the ones the rules reject are
listed: either the entry or the rule needs another look. Run from the backend folder:

    python scripts/import_taglish_compounds.py "<Google Sheets link or CSV path>"
"""

import argparse
import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from preprocessing.lexicon import WORDLIST_DIR, is_word, normalize  # noqa: E402
from sheet_source import is_sheet_link, read_source, table_rows  # noqa: E402

TAB = "Taglish Compound Corpus"
WORD, ENTRY, INCLUSION = "Compound Word (Normalized)", "Standardized Corpus Entry", "Corpus Inclusion"
STATUS = "KWF Orthography Status"
INCLUDE = "include in corpus"
OUTPUT = WORDLIST_DIR / "taglish.txt"


def compound_rows(text):
    return table_rows(text, WORD, (WORD, ENTRY, INCLUSION))


def build(records):
    """(sorted words, skip reasons Counter, problems [(word, message)])."""
    words, skipped, problems = set(), Counter(), []
    for record in records:
        if record[INCLUSION].strip().lower() != INCLUDE:
            skipped["not included"] += 1
            continue
        entry = normalize(record[ENTRY].strip())
        if not entry or "�" in entry:
            skipped["no standardized entry"] += 1
            problems.append((record[WORD], "no usable standardized entry"))
        elif not is_word(entry):
            skipped["not a word of letters"] += 1
            problems.append((record[WORD], f'"{record[ENTRY]}" is not a word of letters'))
        elif entry in words:
            skipped["duplicate"] += 1
        else:
            words.add(entry)
    return sorted(words), skipped, problems


def rule_conflicts(words):
    """Words CA-Spell's affix and hyphen rules reject, judged without the Taglish list itself."""
    from error_detection.code_switching import check_code_switching
    from preprocessing.lexicon import Lexicon

    lexicon = Lexicon()
    lexicon.automata.pop("taglish", None)
    conflicts = []
    for word in words:
        if lexicon.lookup(word):
            continue
        check = check_code_switching(word, lexicon)
        if not check.valid:
            expected = f' (rules expect "{check.expected}")' if check.expected else ""
            conflicts.append(f"{word}: {check.error_type}{expected}")
    return conflicts


def write(words, source_name):
    header = (
        f"# Taglish compound words: {len(words)} entries, one per line.\n"
        f"# Generated {date.today().isoformat()} by scripts/import_taglish_compounds.py from {source_name}\n"
        f'# ("{TAB}" tab, rows marked "Include in Corpus"). Fix entries in the sheet and import again.\n'
    )
    OUTPUT.write_text(header + "".join(f"{word}\n" for word in words), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("source", help=f'link to the validation sheet, or a CSV of its "{TAB}" tab')
    args = parser.parse_args()

    records = list(compound_rows(read_source(args.source, tab=TAB)))
    words, skipped, problems = build(records)

    print(f"{len(records)} compound words in the sheet")
    if STATUS in records[0]:
        print(f"  {STATUS}: {dict(Counter(r[STATUS] or '(empty)' for r in records))}")
    for reason, count in skipped.most_common():
        print(f"  skipped {count}: {reason}")
    for word, message in problems:
        print(f"  {word}: {message}")

    if not words:
        sys.exit(f"No included compound words, so {OUTPUT} was not written.")

    conflicts = rule_conflicts(words)
    if conflicts:
        print(f"{len(conflicts)} entries CA-Spell's affix/hyphen rules reject (kept, but worth a look):")
        for conflict in conflicts:
            print(f"  {conflict}")

    source_name = "the validation sheet" if is_sheet_link(args.source) else Path(args.source).name
    write(words, source_name)
    print(f"{len(words)} words -> {OUTPUT}")
    print("Restart the backend to load them.")


if __name__ == "__main__":
    main()
