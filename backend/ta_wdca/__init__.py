"""TA-WDCA: Taglish-Aware Weighted Dependency Compatibility Algorithm.

Used by the Error Correction Module's Context-Based Candidate Ranking. It scores
how well a candidate word fits the sentence it replaces a misspelled word in,
by comparing the dependency parse of the candidate sentence with the parse of
the original sentence.

    Dependency Neighborhood Analysis (DNA)              dna.py
    Cross-Language Dependency Compatibility (CLDC)      cldc.py
        permitted Taglish head-dependent pairs          rules.py
    Dependency Compatibility Score (DCS)                dcs.py

DCS(c) = w1 * DNA(c) + w2 * CLDC(c)
"""
