"""PREPROCESSING MODULE: Input text -> Tokenization -> Words -> POS Tagging -> UD Parsing.

Runs the pretrained CalamanCy NLP pipeline over the input text.
"""

import warnings

import calamancy
from spacy.util import compile_infix_regex

from preprocessing.lexicon import Lexicon

# The model's meta.json asks for "spacy>=3.8.3" with no upper bound, which spaCy warns about (W094).
# requirements.txt pins spaCy below 3.9, so the warning does not apply.
warnings.filterwarnings("ignore", message=r"\[W094\]")

# Pretrained CalamanCy NLP pipeline (tokenizer, POS tagger, UD dependency parser).
# Loaded once at startup; the first run downloads the model from Hugging Face and
# later runs use the local cache. The named-entity recognizer is not used by any
# module, so it is not loaded (the extra keyword arguments go to spacy.load()).
try:
    nlp = calamancy.load("tl_calamancy_md", exclude=["ner"])
except Exception as exc:
    raise RuntimeError(
        "Could not load the CalamanCy model 'tl_calamancy_md'. "
        "Check that backend/requirements.txt and backend/requirements-calamancy.txt are "
        "installed and that Hugging Face is reachable on the first run."
    ) from exc

# Tokenization: keep hyphenated words ("nag-submit", "mag-aaral", "isa-isa") as
# one token. The default rule splits them into "nag" / "-" / "submit", which hides
# the whole word from the word lists and confuses the parser. Dashes (–, —, --)
# between words still split.
_HYPHEN_BETWEEN_LETTERS = "(?:-|–|—|--|---|——|~)"
if not any(_HYPHEN_BETWEEN_LETTERS in pattern for pattern in nlp.Defaults.infixes):
    raise RuntimeError("CalamanCy's hyphen tokenizer rule changed; update preprocessing/pipeline.py.")
nlp.tokenizer.infix_finditer = compile_infix_regex(
    [
        pattern.replace(_HYPHEN_BETWEEN_LETTERS, "(?:–|—|--|---|——|~)")
        for pattern in nlp.Defaults.infixes
    ]
).finditer

# Automaton representation of the English and Tagalog word lists.
lexicon = Lexicon()


def preprocess(text):
    """Tokenize, POS-tag and UD-parse the text; returns the spaCy Doc."""
    return nlp(text)


def preprocess_many(texts):
    """Same as preprocess() for several texts, batched."""
    return list(nlp.pipe(texts))


def token_features(token):
    return {
        "index": token.i,
        "text": token.text,
        "lemma": token.lemma_,
        "pos": token.pos_,  # POS tagging
        "morph": str(token.morph),  # e.g. "Aspect=Perf|Mood=Ind|Voice=Act"
        "dependency": token.dep_,  # UD parsing
        "head": token.head.text,
        "head_index": token.head.i,
        "start": token.idx,
        "end": token.idx + len(token.text),
        "languages": lexicon.lookup(token.text),
    }
