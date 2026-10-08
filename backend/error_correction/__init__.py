"""ERROR CORRECTION MODULE

Maps to the "Error Correction Module" box of the system architecture diagram:

    Edit distance computation                           edit_distance.py
    Candidate Generation                                candidate_generation.py
    Context-Based Candidate Ranking                     context_ranking.py
        POS Context Scoring  (POS Annotation Score)     context_scoring.py
        UD Context Scoring   (Universal Dependency Score)   context_scoring.py
        Taglish-Aware Weighted Dependency Compatibility Algorithm   ta_wdca/ (separate package)
    Final Candidate Scoring                             final_scoring.py
    Suggested Words (ranked list)                       corrector.py

    Correct Taglish Corpus -> POS tagging -> UD parsing -> Context-Aware Linguistic Annotation
      -> Frequency profiles                             frequency_profile.py, scripts/build_corpus_profile.py

corrector.py runs the stages in order for the error candidates received from the
Error Detection Module (connector A) and the word-list automata (connector B). The
frequency profiles feed the Context-Based Candidate Ranking.
"""
