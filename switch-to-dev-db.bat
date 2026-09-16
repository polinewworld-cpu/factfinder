@echo off
cd /d "%~dp0"
copy /y .env.dev .env >nul
copy /y .env.dev .env.local >nul
echo Switched to DEV (Seoul) database. Run start-site.bat to launch the server.
pause
