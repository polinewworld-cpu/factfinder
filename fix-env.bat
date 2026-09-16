@echo off
cd /d "%~dp0"
node fix-env-corruption.mjs
echo.
echo Done. Restart the dev server (start-site.bat) now.
pause
