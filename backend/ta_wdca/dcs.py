"""TA-WDCA: Dependency Compatibility Score (DCS).

    DCS(c) = w1 * DNA(c) + w2 * CLDC(c)

A candidate scores high when it keeps the syntactic role of the misspelled token
and its language mix is a supported one.
"""

from ta_wdca.cldc import cross_language_compatibility
from ta_wdca.dna import dependency_neighborhood

# The weights are not fixed by the study; equal weights until they are tuned.
DNA_WEIGHT = 0.5
CLDC_WEIGHT = 0.5


def dependency_compatibility(original, candidate, lexicon, dna_weight=DNA_WEIGHT, cldc_weight=CLDC_WEIGHT):
    """Scores the candidate token against the misspelled token it replaces.

    Both tokens come from parsed sentences that differ only in that word.
    """
    dna = dependency_neighborhood(original, candidate, lexicon)
    cldc = cross_language_compatibility(candidate, lexicon)
    return {
        "dna": dna,
        "cldc": cldc,
        "dcs": dna_weight * dna["score"] + cldc_weight * cldc["score"],
    }
