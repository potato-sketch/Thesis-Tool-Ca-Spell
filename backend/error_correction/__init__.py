"""ERROR CORRECTION MODULE

Maps to the "Error Correction Module" box of the system architecture diagram:

    Edit distance computation                           edit_distance.py
    Candidate Generation                                candidate_generation.py
    Context-Based Candidate Ranking                     context_ranking.py
        POS Context Scoring / UD Context Scoring        (components of DNA in ta_wdca/dna.py)
        Taglish-Aware Weighted Dependency Compatibility Algorithm   ta_wdca/ (separate package)
    Final Candidate Scoring                             final_scoring.py
    Suggested Words (ranked list)                       corrector.py

corrector.py runs the stages in order for the error candidates received from the
Error Detection Module (connector A) and the word-list automata (connector B).
"""
