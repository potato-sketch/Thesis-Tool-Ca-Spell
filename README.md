# React + Vite

## Run the API

In a terminal, from the project root:

```powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

The first API start downloads the `tl_calamancy_md` model from Hugging Face.
Keep the backend running, then start the frontend in another terminal with
`npm run dev` from the project root.

## Preprocessing module (`backend/preprocessing/`)

CalamanCy tokenization, POS tagging and UD parsing run in
`backend/preprocessing/pipeline.py`.

The English and Tagalog word lists live in `backend/data/wordlists/` (one word
per line, `#` for comments). On startup the API encodes each list as a minimal
acyclic DFA (`backend/preprocessing/automaton.py`) and caches it in `backend/data/automata/`;
the cache is rebuilt automatically whenever a word list changes.

- `english.txt` is generated from [Open English WordNet](https://github.com/globalwordnet/english-wordnet)
  2025 (CC BY 4.0). To regenerate it:
  `.\.venv\Scripts\python.exe scripts\build_english_wordlist.py`
- `tagalog.txt` is generated from Wiktionary's Tagalog entries via
  [kaikki.org](https://kaikki.org/dictionary/Tagalog/) (CC BY-SA 4.0), a stand-in
  until the KWF Diksiyonaryo list is available. To regenerate it:
  `.\.venv\Scripts\python.exe scripts\build_tagalog_wordlist.py`

## Error detection module (`backend/error_detection/`)

`POST /api/check` runs each token through dictionary look-up, then (for tokens
not in a word list) code-switching and compound word checking, and runs
context-aware annotation and compatibility analysis on the whole sentence.
Each token in the response carries `check`, `annotation` and
`context_conflicts`; the top-level `errors` list holds the error candidates
for the Error Correction Module. See `backend/error_detection/__init__.py` for
which file implements which part of the diagram. The Table 3 and Table 4 rules
are the dictionaries at the top of `annotation.py` and `compatibility.py`, and
the affix inventory and hyphenation rules are in `morphology.py`.

## Error correction module (`backend/error_correction/`) and TA-WDCA (`backend/ta_wdca/`)

Each spelling or hyphenation error from the detection module gets up to five
ranked `suggestions` in the `/api/check` response. A Levenshtein automaton is
traversed with the word-list automata to find words within two edits
(one edit for words of three letters or fewer). Each candidate is placed in the
sentence and re-parsed, then scored by `ta_wdca/` (Dependency Neighborhood
Analysis, Cross-Language Dependency Compatibility, Dependency Compatibility
Score) and by the Context Score from the Correct Taglish Corpus (POS Annotation
Score and Universal Dependency Score). These combine with the Edit Distance Score
into the Final Candidate Score, `FCS = w1*EDS + w2*DCS + w3*CS`. See
`backend/error_correction/__init__.py` for the file-to-diagram map. The weights
and the permitted Taglish pairs in `ta_wdca/rules.py` are placeholders.

The Context Score needs the frequency profile of the Correct Taglish Corpus. Put one
correct Taglish sentence per line in `backend/data/corpus/correct_taglish.txt`, then run
`.\.venv\Scripts\python.exe scripts\build_corpus_profile.py` from `backend`, and restart
the API. Without a profile the Context Score is left out and the other two weights are
scaled to add up to 1.

Run the backend tests with
`.\.venv\Scripts\python.exe -m unittest discover -s tests`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
