# Thesis Tool: Ca-Spell

A Taglish spelling checker. It has a React + Vite front-end and a Python (FastAPI) back-end
that uses CalamanCy for tokenization, POS tagging and dependency parsing.

## 1. What to download and install first

| Requirement | Version | Download | Used for |
|---|---|---|---|
| Git | any recent | https://git-scm.com/downloads | cloning the repository |
| Node.js (includes npm) | 20.19+ or 22.12+ (LTS recommended) | https://nodejs.org/ | front-end (Vite, React) |
| Python | **3.12** (3.13/3.14 are not supported by the dependencies) | https://www.python.org/downloads/ | back-end API |
| A code editor (optional) | VS Code | https://code.visualstudio.com/ | browsing and editing the code |

Also needed:

- **Internet connection** for the first setup. `npm install`, `pip install` and the first API start
  (which downloads the `tl_calamancy_md` model from Hugging Face) all fetch files.
- **Free disk space**: a few GB for the Python packages and the language model.
- **Port 8000 (API) and port 5173 (front-end)** free on your machine.
- When installing Python on Windows, tick **"Add python.exe to PATH"** and keep the **py launcher** enabled.

Check the installs by running:

```powershell
git --version
node --version
npm --version
py -3.12 --version      # Windows; on macOS/Linux use: python3.12 --version
```

## 2. Get the project

```powershell
git clone https://github.com/potato-sketch/Thesis-Tool-Ca-Spell.git
cd Thesis-Tool-Ca-Spell
```

## 3. One-time setup

Run these from the project root:

```powershell
npm install             # installs the front-end packages
npm run setup:backend   # creates backend/.venv312 and installs backend/requirements.txt
```

`npm run setup:backend` needs Python 3.12 and will stop with a message if it cannot find it.

## 4. Run the app

```powershell
npm run dev:all         # starts the API and the front-end together
```

1. Wait for **"Application startup complete"** in the terminal. The first start downloads the
   `tl_calamancy_md` model, so it can take several minutes. Later starts are much faster.
2. Open the address Vite prints (normally http://localhost:5173/) in your browser.
3. Press `Ctrl+C` in the terminal to stop both servers.

The page talks to the API on `http://127.0.0.1:8000`. If the API is not running the browser shows
`ERR_CONNECTION_REFUSED` and the page shows a "can't reach its backend" banner; the page keeps retrying
until the API answers. To point the page at an API somewhere else, set `VITE_API_URL`.

Other commands:

| Command | What it does |
|---|---|
| `npm run backend` | starts only the API (port 8000) |
| `npm run dev` | starts only the front-end |
| `npm run build` | builds the front-end into `dist/` |
| `npm run lint` | runs ESLint |

Starting the API by hand (`uvicorn main:app`) must be done from inside the `backend` folder, or with
`--app-dir backend`; from the project root it fails with "Could not import module main".

## Troubleshooting

- **"Python 3.12 was not found"**: install Python 3.12 from the link above, then rerun `npm run setup:backend`.
- **"The backend is not set up yet"**: run `npm run setup:backend`.
- **"Is port 8000 already in use?"**: close the other program using port 8000 (or an old API window) and retry.
- **Banner says it can't reach the backend**: the API may still be loading the model; wait for
  "Application startup complete".
- **Spell-check results are missing the Context Score**: this is expected until the corpus profile is built
  (see the error correction section below).

## Preprocessing module (`backend/preprocessing/`)

CalamanCy tokenization, POS tagging and UD parsing run in
`backend/preprocessing/pipeline.py`.

The English and Tagalog word lists live in `backend/data/wordlists/` (one word
per line, `#` for comments). On startup the API encodes each list as a minimal
acyclic DFA (`backend/preprocessing/automaton.py`) and caches it in `backend/data/automata/`;
the cache is rebuilt automatically whenever a word list changes.

- `english.txt` is generated from [Open English WordNet](https://github.com/globalwordnet/english-wordnet)
  2025 (CC BY 4.0). To regenerate it:
  `.\.venv312\Scripts\python.exe scripts\build_english_wordlist.py` (from `backend`)
- `tagalog.txt` is generated from Wiktionary's Tagalog entries via
  [kaikki.org](https://kaikki.org/dictionary/Tagalog/) (CC BY-SA 4.0), a stand-in
  until the KWF Diksiyonaryo list is available. To regenerate it:
  `.\.venv312\Scripts\python.exe scripts\build_tagalog_wordlist.py` (from `backend`)

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
`.\.venv312\Scripts\python.exe scripts\build_corpus_profile.py` from `backend`, and restart
the API. Without a profile the Context Score is left out and the other two weights are
scaled to add up to 1.

Run the backend tests from `backend` with
`.\.venv312\Scripts\python.exe -m unittest discover -s tests`.
