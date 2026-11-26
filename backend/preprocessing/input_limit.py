"""PREPROCESSING MODULE: Input text limit.

The system accepts text inputs of up to 500 words (Scope and Limitations of the Study), to keep
processing time and the generation of correction suggestions fast. Words are counted the way the
web app's word counter counts them: runs of characters between whitespace.
"""

MAX_WORDS = 500


def count_words(text):
    return len(text.split())


def check_word_limit(text, limit=MAX_WORDS):
    """Returns the text unchanged, or raises ValueError when it has more than `limit` words."""
    words = count_words(text)
    if words > limit:
        raise ValueError(f"Ca-Spell checks up to {limit} words at a time; this text has {words}.")
    return text
