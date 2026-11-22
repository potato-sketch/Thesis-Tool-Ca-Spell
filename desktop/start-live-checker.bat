@echo off
rem Starts the Ca-Spell live checker for Notepad / Word, and the backend if it is not already running.
rem Double-click this file. The first run sets everything up, which takes a few minutes.
rem Close this window to stop it.
cd /d "%~dp0.."
call npm run desktop
pause
