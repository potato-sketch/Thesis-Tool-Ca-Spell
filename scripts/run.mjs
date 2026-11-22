// One entry point for running Ca-Spell. Every command sets up whatever is missing first, so after
// `npm install` nothing else has to be installed by hand:
//   - creates backend/.venv with any Python 3.11 - 3.14 found on the machine,
//   - installs backend/requirements.txt and CalamanCy (again whenever those files change),
//   - downloads the CalamanCy model and builds the word-list automata,
//   - rebuilds the web app when the front-end changed (for the app served on port 8000).
//
//   node scripts/run.mjs start    build the web app if needed and serve app + API on http://127.0.0.1:8000
//   node scripts/run.mjs dev      API on port 8000 plus the Vite dev server (hot reload) on port 5173
//   node scripts/run.mjs backend  API only, on port 8000
//   node scripts/run.mjs desktop  (Windows) live checker for Notepad/Word; starts the API if it is not running
//   node scripts/run.mjs test     run the backend unit tests
//   node scripts/run.mjs setup    only do the setup steps
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const desktop = path.join(root, "desktop");
const windows = process.platform === "win32";
const venv = path.join(backend, ".venv");
const venvPython = path.join(venv, windows ? "Scripts/python.exe" : "bin/python");
const requirements = path.join(backend, "requirements.txt");
// CalamanCy is installed without its declared dependencies; see the comment in that file.
const calamancyRequirements = path.join(backend, "requirements-calamancy.txt");
// Written after a successful install; holds the hash of the requirements files it installed.
const setupMarker = path.join(venv, ".ca-spell-setup");
const API = "http://127.0.0.1:8000";

const SUPPORTED = ["3.14", "3.13", "3.12", "3.11"];

// Without Windows Developer Mode, Hugging Face copies files instead of symlinking them; that works fine,
// so its warning about it is only noise.
process.env.HF_HUB_DISABLE_SYMLINKS_WARNING ??= "1";

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error || result.status !== 0) fail(`Command failed: ${command} ${args.join(" ")}`);
}

function pythonVersion(command, args = []) {
  const result = spawnSync(command, [...args, "-c", "import sys; print('%d.%d' % sys.version_info[:2])"], {
    encoding: "utf8",
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

// Newest supported Python first, through the Windows py launcher or pythonX.Y on macOS/Linux,
// then whatever plain `python3` / `python` is if it is a supported version.
function findSystemPython() {
  const candidates = [
    ...SUPPORTED.map((v) => (windows ? ["py", [`-${v}`]] : [`python${v}`, []])),
    ["python3", []],
    ["python", []],
  ];
  for (const [command, args] of candidates) {
    if (SUPPORTED.includes(pythonVersion(command, args))) return [command, args];
  }
  return null;
}

function requirementsHash() {
  const hash = createHash("sha256");
  for (const file of [requirements, calamancyRequirements]) hash.update(readFileSync(file));
  return hash.digest("hex");
}

function setupIsCurrent() {
  return existsSync(setupMarker) && readFileSync(setupMarker, "utf8").trim() === requirementsHash();
}

function ensureBackend() {
  if (existsSync(venvPython) && !SUPPORTED.includes(pythonVersion(venvPython))) {
    console.log("backend/.venv is broken or uses an unsupported Python; recreating it.");
    rmSync(venv, { recursive: true, force: true });
  }
  if (existsSync(venvPython) && setupIsCurrent()) return;

  if (!existsSync(venvPython)) {
    const python = findSystemPython();
    if (!python) {
      fail(
        `Python ${SUPPORTED.at(-1)} - ${SUPPORTED[0]} was not found. Install it from https://www.python.org/downloads/` +
          (windows ? ' (keep "py launcher" ticked)' : "") +
          " and run this again.",
      );
    }
    const [command, args] = python;
    console.log(`Setting up the backend with Python ${pythonVersion(command, args)} (one time, a few minutes)...`);
    run(command, [...args, "-m", "venv", venv]);
  } else {
    console.log("The backend requirements changed; updating the backend packages...");
  }
  const pip = [venvPython, "-m", "pip", "install", "--disable-pip-version-check"];
  run(pip[0], [...pip.slice(1), "-r", requirements]);
  run(pip[0], [...pip.slice(1), "--no-deps", "-r", calamancyRequirements]);
  // Importing the pipeline downloads the model (about 200 MB, first time only) and builds the automata.
  console.log("Downloading the CalamanCy model and preparing the word lists...");
  run(venvPython, ["-c", "import preprocessing.pipeline"], { cwd: backend });
  writeFileSync(setupMarker, requirementsHash());
  console.log("Backend ready.\n");
}

// Newest modification time of the front-end sources, so a stale dist/ is rebuilt.
function newestMtime(target) {
  if (!existsSync(target)) return 0;
  const stat = statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(0, ...readdirSync(target).map((name) => newestMtime(path.join(target, name))));
}

function ensureWebBuild() {
  const built = path.join(root, "dist", "index.html");
  const sources = ["src", "public", "index.html", "vite.config.js", "package.json"].map((p) => path.join(root, p));
  if (existsSync(built) && statSync(built).mtimeMs >= Math.max(...sources.map(newestMtime))) return;
  console.log("Building the web app...");
  run(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js"), "build"], { cwd: root });
}

async function apiIsUp() {
  try {
    return (await fetch(`${API}/api/health`, { signal: AbortSignal.timeout(1500) })).ok;
  } catch {
    return false;
  }
}

function startBackend() {
  // --app-dir lets this work from any folder; "main" cannot be imported from the project root otherwise.
  const child = spawn(venvPython, ["-m", "uvicorn", "main:app", "--app-dir", backend, "--port", "8000"], {
    cwd: backend,
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    if (code) console.error(`\nThe backend stopped with exit code ${code}. Is port 8000 already in use?`);
  });
  return child;
}

// Runs the children until one exits or Ctrl+C, then stops the rest.
function supervise(children) {
  const stop = (code) => {
    for (const child of children) child.kill();
    process.exit(code ?? 0);
  };
  process.on("SIGINT", () => stop(0));
  for (const child of children) child.on("exit", stop);
}

const mode = process.argv[2];

if (mode === "setup") {
  ensureBackend();
} else if (mode === "test") {
  ensureBackend();
  run(venvPython, ["-m", "unittest", "discover", "-s", "tests"], { cwd: backend });
} else if (mode === "start") {
  ensureBackend();
  ensureWebBuild();
  console.log(`Ca-Spell will open at ${API}/ once the backend prints "Application startup complete".`);
  supervise([startBackend()]);
} else if (mode === "backend") {
  ensureBackend();
  supervise([startBackend()]);
} else if (mode === "dev") {
  ensureBackend();
  const vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js")], {
    cwd: root,
    stdio: "inherit",
  });
  supervise([startBackend(), vite]);
} else if (mode === "desktop") {
  if (!windows) fail("The live checker for Notepad/Word only runs on Windows.");
  ensureBackend();
  const children = [];
  if (!(await apiIsUp())) {
    console.log("Starting the Ca-Spell backend as well...");
    children.push(startBackend());
  }
  const checker = spawn(venvPython, [path.join(desktop, "live_checker.py"), ...process.argv.slice(3)], {
    cwd: desktop,
    stdio: "inherit",
  });
  supervise([...children, checker]);
} else {
  fail("Usage: node scripts/run.mjs start | dev | backend | desktop | test | setup");
}
