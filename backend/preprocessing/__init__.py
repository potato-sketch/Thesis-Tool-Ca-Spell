"""PREPROCESSING MODULE

Maps to the "Preprocessing Module" box of the system architecture diagram:

    Input text -> Tokenization -> Words -> POS Tagging -> UD Parsing
        pipeline.py    (uses the pretrained CalamanCy NLP pipeline)

    Linguistic Resources Preparation
        English word list, Tagalog word list    data/wordlists/*.txt,
                                                built by scripts/build_*_wordlist.py
        Automaton encoding                      automaton.py
        Automaton representation of word lists  lexicon.py

Nothing is loaded when this package is imported; the CalamanCy model and the
automata load when preprocessing.pipeline is imported (at API startup).
"""
