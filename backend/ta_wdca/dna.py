"""TA-WDCA: Dependency Neighborhood Analysis (DNA).

Checks the candidate token's dependency neighborhood in the candidate sentence:
its head, its relation to the head, and its own dependents.

    DNA(c) = (POS(c) + HEAD(c) + REL(c) + NEIGHBOR(c)) / 4

Each component is 1 when satisfied and 0 when not:

    POS       the candidate's part of speech is one its relation accepts
    HEAD      it attaches to the same word as the misspelled token did, and that
              word's part of speech is one the relation accepts
    REL       its relation is a specific one and not a second subject/object of its head,
              and it is not part of a verb-aspect / time-word conflict (Table 4)
    NEIGHBOR  every dependent attached to it has a part of speech its own relation accepts

The misspelled token's own part of speech and relation are not used as the
reference: the parser guesses them for unknown words and often garbles the
neighboring attachments. Its head is a steadier reference.
"""

from error_detection.annotation import annotate
from error_detection.compatibility import check_compatibility
from ta_wdca.rules import UNIQUE_RELATIONS, dependent_pos_allowed, head_pos_allowed


def _is_root(token):
    return token.head.i == token.i


def _head_text(token):
    return None if _is_root(token) else token.head.text.casefold()


def _has_aspect_conflict(token, lexicon):
    annotations = {t.i: a for t in token.doc if (a := annotate(t, lexicon))}
    return any(
        verb == token.i or any(c["temporal_index"] == token.i for c in conflicts)
        for verb, conflicts in check_compatibility(token.doc, annotations).items()
    )


def dependency_neighborhood(original, candidate, lexicon):
    """Returns {"pos", "head", "rel", "neighbor", "score"} for the candidate token."""
    relation = candidate.dep_.lower()
    root = _is_root(candidate)

    siblings = [
        sibling for sibling in candidate.head.children
        if sibling.i != candidate.i and sibling.dep_.lower() == relation
    ]
    conflict = _has_aspect_conflict(candidate, lexicon)
    components = {
        "pos": int(root or dependent_pos_allowed(relation, candidate.pos_)),
        "head": int(
            _head_text(original) == _head_text(candidate)
            and (root or head_pos_allowed(relation, candidate.head.pos_))
        ),
        "rel": int(
            relation != "dep"
            and not (relation in UNIQUE_RELATIONS and siblings)
            and not conflict
        ),
        "neighbor": int(
            all(
                dependent_pos_allowed(child.dep_, child.pos_) and head_pos_allowed(child.dep_, candidate.pos_)
                for child in candidate.children
            )
        ),
    }
    return {
        **components,
        "aspect_conflict": int(conflict),
        "role": {
            "pos": candidate.pos_,
            "relation": candidate.dep_,
            "head": None if root else candidate.head.text,
            "head_pos": None if root else candidate.head.pos_,
            "original_head": None if _is_root(original) else original.head.text,
            "dependents": [
                {"text": child.text, "relation": child.dep_, "pos": child.pos_} for child in candidate.children
            ],
        },
        "score": sum(components.values()) / len(components),
    }
