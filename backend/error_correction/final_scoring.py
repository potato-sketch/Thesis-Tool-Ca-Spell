"""ERROR CORRECTION MODULE: Final candidate scoring.

    FCS(c) = w1 * EDS(c) + w2 * DCS(c) + w3 * CS(c)

EDS is the Edit Distance Score, DCS the Dependency Compatibility Score from TA-WDCA, and CS the
Context Score from the Correct Taglish Corpus. Without a corpus profile there is no CS, so the
remaining weights are scaled to add up to 1 and the score is FCS(c) = w1' * EDS(c) + w2' * DCS(c).
"""

from error_correction.context_scoring import PAS_WEIGHT, UDS_WEIGHT
from error_correction.edit_distance import MAX_EDIT_DISTANCE
from ta_wdca.dcs import CLDC_WEIGHT, DNA_WEIGHT

# The weights are not fixed by the study; placeholders until they are tuned.
EDS_WEIGHT = 0.4
DCS_WEIGHT = 0.3
CS_WEIGHT = 0.3


def edit_distance_score(distance, max_distance=MAX_EDIT_DISTANCE):
    """1 for an identical word, falling to 1/(max_distance + 1) at the threshold."""
    return max(0.0, 1 - distance / (max_distance + 1))


def effective_weights(has_context_score):
    """(w1, w2, w3) for the scores actually available."""
    if has_context_score:
        return EDS_WEIGHT, DCS_WEIGHT, CS_WEIGHT
    total = EDS_WEIGHT + DCS_WEIGHT
    return EDS_WEIGHT / total, DCS_WEIGHT / total, 0.0


def final_candidate_score(eds, dcs, cs=None):
    w1, w2, w3 = effective_weights(cs is not None)
    return w1 * eds + w2 * dcs + (w3 * cs if cs is not None else 0.0)


def scoring_weights(corpus_loaded):
    """Every weight and threshold behind the scores, for showing the calculation."""
    w1, w2, w3 = effective_weights(corpus_loaded)
    return {
        "max_edit_distance": MAX_EDIT_DISTANCE,
        "corpus_loaded": corpus_loaded,
        "edit_distance": w1,
        "dependency_compatibility": w2,
        "context_score": w3,
        "dependency_neighborhood": DNA_WEIGHT,
        "cross_language": CLDC_WEIGHT,
        "pos_annotation": PAS_WEIGHT,
        "universal_dependency": UDS_WEIGHT,
    }
