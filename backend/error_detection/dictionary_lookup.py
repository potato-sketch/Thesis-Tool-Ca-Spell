"""ERROR DETECTION MODULE: Dictionary look-up.

First validation step: a token found in the English or Tagalog word list
(automaton) is correctly spelled and skips the remaining spelling checks.
"""

from preprocessing.lexicon import is_word, normalize


def is_checkable(token):
    """Only words are spell-checked: not punctuation, numbers, URLs, e-mails,
    acronyms ("NASA") or proper nouns ("Shella")."""
    if token.is_punct or token.like_num or token.like_url or token.like_email:
        return False
    if token.pos_ == "PROPN":
        return False
    if len(token.text) > 1 and token.text.isupper():
        return False
    return is_word(normalize(token.text))


def dictionary_lookup(token, lexicon):
    """Languages whose word list contains the token (empty when not found)."""
    return lexicon.lookup(token.text)
