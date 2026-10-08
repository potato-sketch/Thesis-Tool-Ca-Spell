"""ERROR CORRECTION MODULE: Context Score (POS Context Scoring and UD Context Scoring).

The candidate sentence's annotated patterns around the candidate are looked up in the
frequency profile built from the Correct Taglish Corpus:

    POS Annotation Score (PAS)      = satisfied POS annotation rules / total POS annotation rules
    Universal Dependency Score (UDS) = satisfied dependency relations / total dependency relations
    Context Score (CS)              = 0.5 * PAS + 0.5 * UDS

A rule is satisfied when its pattern occurs in the corpus at least once. The POS annotation
rules are the three-tag windows covering the candidate; the dependency relations are the
candidate's relation to its head and to each of its dependents.
"""

from error_correction.frequency_profile import (
    annotated_tags,
    dependency_patterns,
    pos_pattern,
    pos_windows,
)

PAS_WEIGHT = 0.5
UDS_WEIGHT = 0.5


def _rules(patterns, counts):
    return [{"pattern": pattern, "count": counts.get(pattern, 0)} for pattern in patterns]


def _ratio(rules):
    return sum(1 for rule in rules if rule["count"] > 0) / len(rules) if rules else 0.0


def context_score(token, profile, lexicon):
    """Returns {"pas", "uds", "cs", "pos_rules", "dependency_rules"} for the candidate token."""
    doc = token.doc
    tags = annotated_tags(doc, lexicon)
    pos_rules = _rules(
        (pos_pattern(window) for window in pos_windows(tags, token.i)), profile.pos_patterns
    )
    dependency_rules = _rules(dependency_patterns(doc, tags, token.i), profile.dependency_patterns)
    pas = _ratio(pos_rules)
    uds = _ratio(dependency_rules)
    return {
        "pas": pas,
        "uds": uds,
        "cs": PAS_WEIGHT * pas + UDS_WEIGHT * uds,
        "pos_rules": pos_rules,
        "dependency_rules": dependency_rules,
    }
