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
| `npm run setup:desktop` | one-time setup of the Notepad/Word live checker (Windows) |
| `npm run desktop` | runs the live checker (the API must be running) |

Starting the API by hand (`uvicorn main:app`) must be done from inside the `backend` folder, or with
`--app-dir backend`; from the project root it fails with "Could not import module main".

## 5. Browser extension and desktop apps (Word, Notepad)

The spell checker itself (Python + CalamanCy) cannot run inside a browser or inside Word/Notepad. So
both the extension and the desktop hotkey are just *front doors* that send your text to the **Ca-Spell
backend running on your own computer**. Nothing works unless the backend is running.

### Step 0: start the backend (needed for everything below)

1. Finish sections 1-3 above (`npm install` and `npm run setup:backend`) once.
2. Build the web app, then start the backend, in a terminal in the project root:

   ```powershell
   npm run build       # needed once, and again after you change the front-end
   npm run backend
   ```

3. Wait until the terminal prints `Uvicorn running on http://127.0.0.1:8000`. Loading the language
   model takes about 30-60 seconds (much longer the very first time). Leave this window open.
4. Check it: open http://127.0.0.1:8000/api/health in a browser. You should see `{"status":"ok", ...}`.
   Opening http://127.0.0.1:8000/ should show the Ca-Spell app.

> If you ran `npm run build` while the backend was already running, **stop it (`Ctrl+C`) and start it again**.
> The backend only looks for the built app at startup. Without a build, http://127.0.0.1:8000/ shows
> `{"detail":"Not Found"}`.

### Part A: browser extension (Chrome, Edge, Brave, Opera, Vivaldi)

Needs a Chromium browser, version 114 or newer. **Firefox and Safari are not supported.**

1. In the project root run `npm run build:extension`. This creates the folder `dist-extension`, which
   must contain `manifest.json`, `background.js`, `index.html` and `assets/`.
2. Open `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select the **`dist-extension`** folder itself (the one that directly
   contains `manifest.json`, not the project folder and not `dist`).
5. Click the puzzle-piece icon in the toolbar and **pin** Ca-Spell so it is always visible.
6. Use it, with the backend running:
   - Click the Ca-Spell icon: the app opens in a side panel.
   - Select text on a web page, right-click, and choose **Check "..." with Ca-Spell**. The panel opens
     with that text already loaded.
   - Or select text and press **Alt+Shift+C**. If nothing happens, another extension probably owns that
     shortcut; change it at `chrome://extensions/shortcuts`.

After you change any code, run `npm run build:extension` again and click the circular reload arrow on
the Ca-Spell card in `chrome://extensions`. Then close and reopen the side panel.

Limits: the extension cannot read text on browser pages such as `chrome://...` or the Chrome Web Store
(the panel still opens; paste the text in yourself). Editors such as **Word on the web and Google Docs**
may not expose the selection to the extension; if the panel stays empty, copy the text and paste it
into the Ca-Spell panel.

### Part B: live checker for Notepad and Word (underlines as you type)

This works like Grammarly on the desktop. A small background program watches the text box you are typing in,
sends the text to the Ca-Spell backend, and draws an **orange wavy underline** under misspelled words. Click an
underlined word to get a popup of suggestions; click one and it replaces the word in place. No copy and paste.

```
type in Notepad -> pause for a moment -> orange underlines appear -> click a word -> click a suggestion
```

How it works: Windows UI Automation (the same technology screen readers use) reads the text and the exact
position of each word. The underlines are drawn on a see-through window laid over Notepad, so they never
change your file. It does not need Node or AutoHotkey, only Python 3.12 (already needed by the backend).

**One-time setup** (Windows only), in a terminal in the project folder:

```powershell
npm run setup:desktop
```

This creates `desktop/.venv` and installs the one package it needs (`uiautomation`). It takes under a minute.

**Every time you want to use it**

1. Start the backend (**Step 0**) and wait for `Uvicorn running on http://127.0.0.1:8000`.
2. Start the live checker, either way:
   - in a second terminal: `npm run desktop`, or
   - double-click `desktop\start-live-checker.bat`. It also starts the backend if it is not running.
3. Wait for the message `Ca-Spell live checker is running for: notepad.exe, winword.exe`. Leave that window open.
4. Open Notepad, click into the text area, and type some Taglish with a typo, for example
   `Kumain ako ng pagkain kanina, masarap ang kaen`.
5. Stop typing for about a second. Misspelled words get an orange underline.
6. **Click** an underlined word. A popup shows up to five suggestions. Click one to replace the word, or click
   **Ignore** to hide that word until you restart the checker. Click anywhere else to close the popup.
7. To stop it, press `Ctrl+C` in its window or just close the window.

**Things to know**

- **Turn off Notepad's own spell check.** Windows 11 Notepad underlines words in **red** using an English-only
  dictionary, so it flags many correct Tagalog words. Ca-Spell's underlines are **orange**. To remove the red
  ones: Notepad -> Settings (gear icon, top right) -> turn off *Spell check*.
- **Big pastes are fine.** The checker first asks the backend only *which words are misspelled* (about 1-2
  seconds for a page of text) and fetches suggestions for a word only when you click it (under a second), so
  long text no longer has to wait for suggestions on every error. Only the underlines for the part of the
  document on screen are drawn; scroll and they appear. The first 10,000 characters of a document are checked.
- **After updating the project, restart the backend** (`Ctrl+C`, then `npm run backend`). The checker prints
  "The running backend is out of date" if you forget.
- Only the text box that has the keyboard focus is checked.
- Only **Notepad and Word** are checked by default, so Ca-Spell never reads your other programs. To change that:
  `npm run desktop -- --apps notepad.exe,winword.exe,wordpad.exe`, or `--apps "*"` for every program.
  Password boxes are always skipped.
- `npm run desktop -- --delay 1.5` waits longer after you stop typing before checking (default 0.7 seconds).
- Both Notepad windows and tabs work. Underlines hide while you click into another program and come back when
  you return to the text box.
- Notepad was tested. **Word is enabled but has not been tested yet**: Word exposes its text differently, so
  underline positions may be off. If Word misbehaves, use the hotkey in Part C instead.
- The orange underlines are drawn on top of the screen. Pop-up menus that open over your text (for example
  Notepad's File menu) can appear *under* an underline for a moment; it goes away when the menu closes.
- If Notepad or Word is running **as administrator**, run the live checker as administrator too (Windows does
  not let normal programs read elevated windows).
- It may be flagged by antivirus software because it listens for mouse clicks system-wide (that is how it knows
  you clicked an underlined word). It does not record or send anything except the text of the allowed program.

### Part C: hotkey for MS Word and Notepad (copy, fix in the browser, paste back)

Use this if the live checker does not work for you, or for programs it cannot read.

A browser extension cannot see desktop programs, so Word and Notepad use a small helper script instead.
The script, [`desktop/ca-spell-hotkey.ahk`](desktop/ca-spell-hotkey.ahk), runs in the background and waits for a
hotkey. When you press it, it copies whatever text you have selected and opens it in Ca-Spell in your default
browser. You fix the text there, copy it, and paste it back into your document.

```
select text in Word/Notepad -> press Ctrl+Shift+K -> Ca-Spell opens in your browser with the text
   -> fix errors, click Copy -> return to Word/Notepad -> Ctrl+V
```

**What you need before starting**
- The backend running (**Step 0** above). Test it first: http://127.0.0.1:8000/ must show the Ca-Spell app.
- AutoHotkey **v2** (free). There is nothing else to configure; the defaults work.

**1. Install AutoHotkey v2**

1. Go to https://www.autohotkey.com/ and click **Download**, then **Download v2.0**.
2. Run the installer. Choose **Express Installation**, then close the installer.
3. Check it: open File Explorer, right-click empty space, and choose **New**. You should see
   *AutoHotkey Script* in the list. (Or press `Win` and type "AutoHotkey"; AutoHotkey v2 should appear.)

If you already have AutoHotkey **v1**, uninstall it first, or the script will show a "requires AutoHotkey v2.0"
error.

**2. Start the script**

1. Open File Explorer in the project folder, then open the `desktop` folder.
2. Double-click `ca-spell-hotkey.ahk`.
   - Nothing visible happens, and that is normal. Look in the system tray at the bottom right of the screen
     for a green **H** icon. **On Windows 11 new tray icons are usually hidden**: click the small `^` arrow
     next to the clock to show them. To keep it always visible, drag the icon out of that menu onto the taskbar,
     or open *Settings -> Personalization -> Taskbar -> Other system tray icons* and switch on *AutoHotkey*.
   - You can also confirm it is running without the icon: press `Ctrl+Shift+Esc`, open **Task Manager**, and
     look for *AutoHotkey 64-bit* in the list (or on the *Details* tab).
   - Double-clicking the script again while it is running just restarts it; it does not start a second copy.
   - An error dialog means AutoHotkey v2 is not installed, or v1 is installed instead (see step 1).
   - If Windows asks which program should open the file, choose **AutoHotkey 64-bit** and tick "Always".

**3. Use it in Notepad**

1. Open Notepad and type or paste some Taglish text, for example `Kumain ako ng pagkain kanina`.
2. **Select** the text: drag with the mouse, or press `Ctrl+A` to select everything.
3. Press **Ctrl+Shift+K**. Your browser opens Ca-Spell with the text already loaded. The first check can take a few
   seconds.
4. Review the suggestions in Ca-Spell, accept the corrections, and click the **Copy** button on the *Original
   Text* panel (the copy icon in the top right of that panel).
5. Switch back to Notepad. Your selection should still be highlighted; if it is not, select the same text again.
6. Press **Ctrl+V**. The corrected text replaces the original.

**4. Use it in MS Word**

Exactly the same: select a word, a sentence, or a paragraph (`Ctrl+A` selects the whole document), press
**Ctrl+Shift+K**, correct it in the browser, click **Copy**, return to Word, and press **Ctrl+V** with the same text
still selected. (Word's *Keep Text Only* paste option is the safest if you want to keep your formatting.)

**Changing the settings**

Open `ca-spell-hotkey.ahk` in Notepad. The settings are at the top of the file:

| Setting | Default | What it does |
|---|---|---|
| `HOTKEY_KEYS` | `^+k` (Ctrl+Shift+K) | The key combination. `^` = Ctrl, `+` = Shift, `!` = Alt, `#` = Windows key. For example `^+y` is Ctrl+Shift+Y. Avoid Alt and Windows-key combinations: Notepad and Word react to the Alt release by showing menu shortcut letters (F, E, V...) and the copy fails. |
| `APP_URL` | `http://127.0.0.1:8000/` | Where Ca-Spell is served. Change it if you use another port, or `http://localhost:5173/` with `npm run dev`. |
| `MAX_CHARS` | `3000` | The longest selection that is sent. The app itself accepts at most 500 words. |

After editing, save the file. Then right-click the green **H** tray icon and choose **Reload Script**.

**Running it automatically when you sign in to Windows**

1. Press `Win+R`, type `shell:startup`, and press Enter. A folder opens.
2. Right-click `ca-spell-hotkey.ahk`, choose **Show more options -> Create shortcut**, and move the shortcut into the
   startup folder.

The backend does not start by itself; you still need to run `npm run backend` before using the hotkey.

**Stopping it:** right-click the green **H** tray icon and choose **Exit**.

**Good to know**
- Your clipboard is restored after the script copies your selection, so you do not lose what you had copied.
- Only the first 3000 characters are sent. The app takes up to 500 words.
- The script cannot write corrections back into the document for you; you paste them in yourself. Doing that
  automatically would need a Microsoft Office add-in, which is not part of this project.
- If Word or Notepad is running **as administrator**, the script has to be run as administrator too (right-click
  the script and choose **Run as administrator**). Otherwise Windows blocks it from copying.
- Browser tabs opened by the hotkey stay open. Close them when you are done.

### If something doesn't work

| What you see | Cause and fix |
|---|---|
| App shows a "can't reach its backend" banner | The backend is not running or is still loading. Do Step 0 and wait for `Uvicorn running on ...`. |
| `ERR_CONNECTION_REFUSED` at 127.0.0.1:8000 | Same: the backend is not running. |
| `{"detail":"Not Found"}` at http://127.0.0.1:8000/ | The app was not built when the backend started. Run `npm run build`, then restart the backend. |
| "Manifest file is missing or unreadable" when loading | You selected the wrong folder. Pick `dist-extension` (it must directly contain `manifest.json`). |
| Extension loads but the panel is blank | Rebuild with `npm run build:extension`, click *reload* on the extension, reopen the panel. In `chrome://extensions` click *service worker* / *Errors* for details. |
| Right-click item or `Alt+Shift+C` does nothing | Reload the extension. The shortcut may be taken (see `chrome://extensions/shortcuts`). It does nothing on `chrome://` pages. |
| Extension panel says it can't reach the backend, but the health URL works | The backend was started before the extension support was added (it only allows `chrome-extension://` pages in the new version). Stop it with `Ctrl+C` and start it again. |
| Hotkey script shows an error dialog | You need AutoHotkey **v2**. Uninstall v1 or install v2 and reopen the script. |
| Live checker: "The live checker is not set up yet" | Run `npm run setup:desktop` once. |
| Live checker: "Waiting for the Ca-Spell backend..." | The backend is not running or still loading. Do Step 0; it continues by itself when the backend is ready. |
| Live checker: no underlines in Notepad | Click inside the text area first (it only checks the focused text box), type a clear typo such as `kaen`, and stop typing for a second. Check the checker window for errors, and run it with `npm run desktop -- --verbose`. |
| Live checker: "The running backend is out of date" | The backend was started before the live checker was added. Stop it (`Ctrl+C`) and run `npm run backend` again. |
| Live checker: underlines are red, not orange | Those are Notepad's own English spell check. Turn it off in Notepad's settings (see Part B). |
| Live checker: underlines are in the wrong place | Make sure Windows display scaling and Notepad are on the same screen, then retype a character to refresh. If it persists in Word, use the hotkey (Part C). |
| Hotkey does nothing | Check the green **H** tray icon exists (if not, double-click the script again). Make sure text is selected. Try a different key combination: another program may already use Ctrl+Shift+K. Run the script as administrator if Word/Notepad is. |
| Letters (F, E, V, H, L, B...) appear over Notepad's or Word's toolbar and nothing opens | You are using a combination with **Alt** (the old default was Ctrl+Alt+C). Update the script to the current version (`HOTKEY_KEYS := "^+k"`) and choose **Reload Script** from the tray icon. Press `Esc` once to dismiss the letters. |
| Tooltip "Ca-Spell: select some text first" | The copy found no selection. Select the text again, then press the hotkey. |
| Browser opens a "can't be reached" page | The backend is not running. Do Step 0, then press the hotkey again. |
| Browser opens Ca-Spell but the text is empty or cut off | Only the first 3000 characters are sent (see `MAX_CHARS`), and the app takes at most 500 words. |
| Edited the script but nothing changed | Right-click the green **H** tray icon and choose **Reload Script**. |
| Browser opens but Ca-Spell shows the welcome page with no text | Restart the backend after `npm run build` so the newest app is served. |

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
