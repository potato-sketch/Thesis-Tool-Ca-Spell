"""Builds the frequency profile from the Correct Taglish Corpus.

Put one correct Taglish sentence per line in backend/data/corpus/correct_taglish.txt (lines starting
with # are ignored), then run from the backend folder:

    python scripts/build_corpus_profile.py [path to another corpus file]

The profile is written to backend/data/corpus/frequency_profile.json and loaded when the API starts.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from error_correction.frequency_profile import CORPUS_PATH, PROFILE_PATH, FrequencyProfile  # noqa: E402
from preprocessing.pipeline import lexicon, preprocess_many  # noqa: E402

BATCH = 64


def sentences(path):
    with Path(path).open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line and not line.startswith("#"):
                yield line


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else CORPUS_PATH
    if not path.exists():
        sys.exit(f"No corpus at {path}. Put one correct Taglish sentence per line there first.")

    profile = FrequencyProfile()
    batch = []
    for sentence in sentences(path):
        batch.append(sentence)
        if len(batch) == BATCH:
            for doc in preprocess_many(batch):
                profile.add_sentence(doc, lexicon)
            batch = []
    for doc in preprocess_many(batch) if batch else []:
        profile.add_sentence(doc, lexicon)

    if not profile.sentences:
        sys.exit(f"{path} has no sentences.")
    profile.save(PROFILE_PATH)
    print(
        f"{profile.sentences} sentences -> {len(profile.pos_patterns)} POS annotation patterns, "
        f"{len(profile.dependency_patterns)} dependency patterns -> {PROFILE_PATH}"
    )


if __name__ == "__main__":
    main()
