@echo off
REM Stop Python and KlassePlass so git pull / updater can replace files.
REM Run this before pulling updates (e.g. git pull).
cd /d "%~dp0.."

echo Stopping Python processes...
taskkill /F /IM python.exe 2>nul
taskkill /F /IM pythonw.exe 2>nul

echo Stopping KlassePlass...
taskkill /F /IM KlassePlass.exe 2>nul

echo Waiting 2 seconds for processes to exit...
timeout /t 2 /nobreak >nul

echo Running git pull...
git pull

echo Done.
pause
