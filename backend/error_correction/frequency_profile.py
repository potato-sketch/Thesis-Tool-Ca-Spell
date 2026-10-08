"""ERROR CORRECTION MODULE: Frequency profiles from the Correct Taglish Corpus.

Correct Taglish Corpus -> POS tagging -> UD parsing -> Context-Aware Linguistic Annotation
  -> frequency profiles

Each corpus sentence is parsed and annotated (Table 3), then two kinds of patterns are counted:

    POS annotation patterns   three consecutive annotated tags, e.g. "VERB-PAST PRON ADV-PAST"
    dependency patterns       "head tag|relation|dependent tag", e.g. "VERB-PAST|nsubj|PRON"

Sentence boundaries are padded with <s> and </s>; the root has the head tag <root>.
"""

import json
from collections import Counter
from pathlib import Path

from error_detection.annotation import annotate

CORPUS_DIR = Path(__file__).resolve().parent.parent / "data" / "corpus"
CORPUS_PATH = CORPUS_DIR / "correct_taglish.txt"  # one correct sentence per line
PROFILE_PATH = CORPUS_DIR / "frequency_profile.json"
FORMAT_VERSION = 1

START, END, ROOT = "<s>", "</s>", "<root>"


def annotated_tags(doc, lexicon):
    """Enhanced POS tag per token: the Table 3 annotation (VERB-PAST, ADV-FUTURE) or the plain POS tag."""
    tags = []
    for token in doc:
        annotation = annotate(token, lexicon)
        tags.append(annotation["annotation"] if annotation else token.pos_)
    return tags


def pos_pattern(window):
    return " ".join(window)


def dependency_pattern(head_tag, relation, dependent_tag):
    return f"{head_tag}|{relation.split(':')[0].lower()}|{dependent_tag}"


def pos_windows(tags, index=None):
    """Three-tag windows over the padded sentence; only those covering `index` when given."""
    padded = [START, *tags, END]
    first = 0 if index is None else max(0, index - 1)
    last = len(padded) - 3 if index is None else min(index + 1, len(padded) - 3)
    return [padded[start : start + 3] for start in range(first, last + 1)]


def dependency_patterns(doc, tags, index=None):
    """Dependency patterns of every token, or only those involving token `index`."""
    patterns = []
    for token in doc:
        head_tag = ROOT if token.head.i == token.i else tags[token.head.i]
        if index is None or token.i == index or token.head.i == index:
            patterns.append(dependency_pattern(head_tag, token.dep_, tags[token.i]))
    return patterns


class FrequencyProfile:
    def __init__(self, sentences=0, pos_patterns=None, dependency_patterns=None):
        self.sentences = sentences
        self.pos_patterns = Counter(pos_patterns or {})
        self.dependency_patterns = Counter(dependency_patterns or {})

    def add_sentence(self, doc, lexicon):
        tags = annotated_tags(doc, lexicon)
        self.sentences += 1
        self.pos_patterns.update(pos_pattern(window) for window in pos_windows(tags))
        self.dependency_patterns.update(dependency_patterns(doc, tags))

    def save(self, path=PROFILE_PATH):
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": FORMAT_VERSION,
            "sentences": self.sentences,
            "pos_patterns": dict(self.pos_patterns),
            "dependency_patterns": dict(self.dependency_patterns),
        }
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=1, sort_keys=True), encoding="utf-8")

    @classmethod
    def load(cls, path=PROFILE_PATH):
        """The saved profile, or None when there is none yet."""
        path = Path(path)
        if not path.exists():
            return None
        payload = json.loads(path.read_text(encoding="utf-8"))
        if payload.get("version") != FORMAT_VERSION or not payload.get("sentences"):
            return None
        return cls(payload["sentences"], payload["pos_patterns"], payload["dependency_patterns"])
