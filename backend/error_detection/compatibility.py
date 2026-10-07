"""ERROR DETECTION MODULE: Context Compatibility Analysis.

Checks whether a verb's aspect annotation agrees with the time expression that
modifies it (Table 4). "Nag-submit ako bukas." pairs VERB-PAST with ADV-FUTURE,
which is incompatible, so "Nag-submit" is flagged as a contextual error.
"""

# Table 4. Context compatibility rules. Pairs not listed are not judged.
COMPATIBILITY_RULES = {
    ("VERB-PAST", "ADV-PAST"): True,
    ("VERB-PAST", "ADV-FUTURE"): False,
    ("VERB-FUTURE", "ADV-FUTURE"): True,
    ("VERB-FUTURE", "ADV-PAST"): False,
}


def governing_verb(token, annotations):
    """The annotated verb the time expression modifies, found by following UD
    head links upward ("mamaya" -> "project" -> "magsu-submit")."""
    current = token
    while current.head.i != current.i:
        current = current.head
        annotation = annotations.get(current.i)
        if annotation and annotation["annotation"].startswith("VERB"):
            return current
    return None


def check_compatibility(doc, annotations):
    """Returns {verb token index: [conflict, ...]} for incompatible pairs."""
    conflicts = {}
    for token in doc:
        temporal = annotations.get(token.i)
        if not temporal or not temporal["annotation"].startswith("ADV"):
            continue
        verb = governing_verb(token, annotations)
        if verb is None:
            continue
        verb_annotation = annotations[verb.i]["annotation"]
        compatible = COMPATIBILITY_RULES.get((verb_annotation, temporal["annotation"]))
        if compatible is False:
            conflicts.setdefault(verb.i, []).append(
                {
                    "verb": verb.text,
                    "verb_annotation": verb_annotation,
                    "temporal": token.text,
                    "temporal_index": token.i,
                    "temporal_annotation": temporal["annotation"],
                }
            )
    return conflicts
