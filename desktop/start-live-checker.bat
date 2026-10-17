@echo off
rem Starts the Ca-Spell backend (if it is not already running) and the live checker for Notepad / Word.
rem Double-click this file. Close the live checker window to stop it.
cd /d "%~dp0.."

powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 http://127.0.0.1:8000/api/health) | Out-Null; exit 0 } catch { exit 1 }"
if errorlevel 1 (
    echo Starting the Ca-Spell backend in a separate window...
    start "Ca-Spell backend" /min cmd /c "npm run backend"
)

if not exist "desktop\.venv\Scripts\python.exe" (
    echo The live checker is not set up yet. Run:  npm run setup:desktop
    pause
    exit /b 1
)

"desktop\.venv\Scripts\python.exe" "desktop\live_checker.py"
pause
