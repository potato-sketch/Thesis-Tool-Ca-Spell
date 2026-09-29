"""ERROR DETECTION MODULE

Maps to the "Error Detection Module" box of the system architecture diagram:

    Dictionary look-up                                  dictionary_lookup.py
    Code-switching & compound word checking             code_switching.py
        Hyphen-based splitting                          code_switching.hyphen_based_splitting
        Affix boundary detection                        code_switching.affix_boundary_detection
    Morphological rules (Taglish)                       morphology.py
    Context-Aware Linguistic Annotation (Table 3)       annotation.py
        Aspect Annotation (verbs)
        Temporal Annotation (time expression)
    Context Compatibility Analysis (Table 4)            compatibility.py

detector.py runs the stages in order and outputs the error candidates passed
to the Error Correction Module (connector A in the diagram).
"""
