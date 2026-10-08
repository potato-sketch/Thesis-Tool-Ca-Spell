// Starts or sets up the backend so the front-end has an API to talk to.
//   node scripts/run.mjs setup    create backend/.venv and install the requirements
//   node scripts/run.mjs backend  start the API on port 8000
//   node scripts/run.mjs dev      start the API and the Vite dev server together
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backend = path.join(root, "backend");
const windows = process.platform === "win32";
const venvNames = [".venv312", ".venv", ".venv314"];
const setupVenv = ".venv312";

function venvPython(name) {
  return path.join(backend, name, windows ? "Scripts/python.exe" : "bin/python");
}

// A virtual environment can exist without the requirements installed in it.
function hasRequirements(python) {
  return spawnSync(python, ["-c", "import uvicorn, fastapi, calamancy"], { stdio: "ignore" }).status === 0;
}

function findPython() {
  return venvNames.map(venvPython).find((python) => existsSync(python) && hasRequirements(python)) ?? null;
}

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.error || result.status !== 0) {
    fail(`Command failed: ${command} ${args.join(" ")}`);
  }
}

function setup() {
  // Python 3.12 is the version CalamanCy and its dependencies install cleanly on.
  const [python, ...prefix] = windows ? ["py", "-3.12"] : ["python3.12"];
  if (spawnSync(python, [...prefix, "--version"], { stdio: "ignore" }).status !== 0) {
    fail("Python 3.12 was not found. Install it from https://www.python.org/downloads/ and run this again.");
  }
  if (!existsSync(venvPython(setupVenv))) run(python, [...prefix, "-m", "venv", path.join(backend, setupVenv)]);
  const venv = venvPython(setupVenv);
  run(venv, ["-m", "pip", "install", "--upgrade", "pip"]);
  run(venv, ["-m", "pip", "install", "-r", path.join(backend, "requirements.txt")]);
  console.log("\nBackend ready. Start it with: npm run backend");
}

function startBackend() {
  const python = findPython();
  if (!python) {
    fail("The backend is not set up yet. Run: npm run setup:backend");
  }
  // --app-dir lets this work from any folder; "main" cannot be imported from the project root otherwise.
  const child = spawn(
    python,
    ["-m", "uvicorn", "main:app", "--app-dir", backend, "--port", "8000"],
    { cwd: backend, stdio: "inherit" },
  );
  child.on("exit", (code) => {
    if (code) console.error(`\nThe backend stopped with exit code ${code}. Is port 8000 already in use?`);
  });
  return child;
}

const mode = process.argv[2];

if (mode === "setup") {
  setup();
} else if (mode === "backend") {
  startBackend().on("exit", (code) => process.exit(code ?? 0));
} else if (mode === "dev") {
  const api = startBackend();
  const vite = spawn(process.execPath, [path.join(root, "node_modules/vite/bin/vite.js")], {
    cwd: root,
    stdio: "inherit",
  });
  const stop = () => {
    api.kill();
    vite.kill();
  };
  process.on("SIGINT", () => {
    stop();
    process.exit(0);
  });
  api.on("exit", stop);
  vite.on("exit", (code) => {
    api.kill();
    process.exit(code ?? 0);
  });
} else {
  fail("Usage: node scripts/run.mjs setup | backend | dev");
}
