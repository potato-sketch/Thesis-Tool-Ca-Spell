"""TA-WDCA: permitted Taglish pairs and universal dependency relation profiles.

CROSS_LANGUAGE_RULES: a relation between a head and a dependent written in
different languages (for example the English noun "assignment" as the object of
the Taglish verb "nag-submit") is valid when its (head POS, relation, dependent
POS) triple is listed. A stand-in until the validated Taglish corpus and the KWF
rules are available to supply the supported pairs.

RELATION_PROFILES: the parts of speech each universal dependency relation
accepts on the dependent and on the head side. Relations not listed are not judged.
"""

_NOMINALS = ("NOUN", "PROPN", "PRON")

CROSS_LANGUAGE_RULES = frozenset(
    {("VERB", "nsubj", dependent) for dependent in _NOMINALS}
    | {("VERB", "obj", dependent) for dependent in _NOMINALS}
    | {("VERB", "iobj", dependent) for dependent in _NOMINALS}
    | {("VERB", "obl", dependent) for dependent in _NOMINALS}
    | {
        ("VERB", "advmod", "ADV"),
        ("VERB", "xcomp", "VERB"),
        ("VERB", "ccomp", "VERB"),
        ("VERB", "advcl", "VERB"),
        ("VERB", "conj", "VERB"),
        ("VERB", "aux", "AUX"),
        ("VERB", "mark", "SCONJ"),
        ("VERB", "cc", "CCONJ"),
        ("VERB", "discourse", "PART"),
        ("ADJ", "advmod", "ADV"),
        ("ADJ", "obl", "NOUN"),
        ("ADV", "advmod", "ADV"),
    }
    | {(head, "amod", "ADJ") for head in _NOMINALS}
    | {(head, "det", "DET") for head in _NOMINALS}
    | {(head, "case", "ADP") for head in _NOMINALS}
    | {(head, "nummod", "NUM") for head in _NOMINALS}
    | {(head, "nmod", dependent) for head in _NOMINALS for dependent in _NOMINALS}
    | {(head, "compound", dependent) for head in _NOMINALS for dependent in _NOMINALS}
    | {(head, "appos", dependent) for head in _NOMINALS for dependent in _NOMINALS}
    | {(head, "conj", dependent) for head in _NOMINALS for dependent in _NOMINALS}
    | {(head, "acl", "VERB") for head in _NOMINALS}
)

_PREDICATES = ("VERB", "ADJ", "NOUN", "PROPN", "PRON", "ADV", "AUX")

# relation -> (parts of speech of the dependent, parts of speech of the head)
RELATION_PROFILES = {
    "nsubj": (_NOMINALS + ("NUM", "VERB"), _PREDICATES),
    "obj": (_NOMINALS + ("NUM",), ("VERB",)),
    "iobj": (_NOMINALS, ("VERB",)),
    "obl": (_NOMINALS + ("ADV", "NUM"), _PREDICATES),
    "advmod": (("ADV", "PART", "ADJ", "NOUN"), _PREDICATES),
    "amod": (("ADJ", "VERB", "NUM"), _NOMINALS),
    "det": (("DET", "PRON", "PART"), _NOMINALS),
    "case": (("ADP", "PART", "SCONJ"), _PREDICATES),
    "nummod": (("NUM",), _NOMINALS),
    "nmod": (_NOMINALS, _NOMINALS),
    "aux": (("AUX", "PART", "VERB"), ("VERB", "ADJ")),
    "cop": (("AUX", "PRON", "VERB"), _PREDICATES),
    "mark": (("SCONJ", "PART", "ADP"), ("VERB", "ADJ")),
    "cc": (("CCONJ", "SCONJ", "ADV"), _PREDICATES),
    "punct": (("PUNCT", "SYM"), None),
}

# A head takes at most one of these.
UNIQUE_RELATIONS = frozenset({"nsubj", "csubj", "obj", "iobj"})


def _base(relation):
    return relation.split(":")[0].lower()


def is_supported(head_pos, relation, dependent_pos):
    """Relation subtypes ("nsubj:pass") are judged by their base relation."""
    return (head_pos, _base(relation), dependent_pos) in CROSS_LANGUAGE_RULES


def dependent_pos_allowed(relation, pos):
    profile = RELATION_PROFILES.get(_base(relation))
    return profile is None or profile[0] is None or pos in profile[0]


def head_pos_allowed(relation, pos):
    profile = RELATION_PROFILES.get(_base(relation))
    return profile is None or profile[1] is None or pos in profile[1]
