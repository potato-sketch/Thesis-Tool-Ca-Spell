"""ERROR CORRECTION MODULE: Final candidate scoring.

    FCS(c) = w1 * EDS(c) + w2 * DCS(c)

EDS is the edit distance score and DCS the Dependency Compatibility Score from TA-WDCA.
"""

from error_correction.edit_distance import MAX_EDIT_DISTANCE
from ta_wdca.dcs import CLDC_WEIGHT, DNA_WEIGHT

# The weights are not fixed by the study; spelling similarity counts a little more than the
# coarse 0-1 context components.
EDS_WEIGHT = 0.6
DCS_WEIGHT = 0.4


def edit_distance_score(distance, max_distance=MAX_EDIT_DISTANCE):
    """1 for an identical word, falling to 1/(max_distance + 1) at the threshold."""
    return max(0.0, 1 - distance / (max_distance + 1))


def final_candidate_score(eds, dcs, eds_weight=EDS_WEIGHT, dcs_weight=DCS_WEIGHT):
    return eds_weight * eds + dcs_weight * dcs


def scoring_weights():
    """Every weight and threshold behind the scores, for showing the calculation."""
    return {
        "max_edit_distance": MAX_EDIT_DISTANCE,
        "edit_distance": EDS_WEIGHT,
        "dependency_compatibility": DCS_WEIGHT,
        "dependency_neighborhood": DNA_WEIGHT,
        "cross_language": CLDC_WEIGHT,
    }
