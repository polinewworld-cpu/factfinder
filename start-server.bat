@echo off
cd /d "%~dp0"
echo Starting server. DO NOT click inside this window while it's running
echo (clicking the console pauses it on Windows). Once you see "Ready",
echo open http://localhost:3411 in your browser and leave this window alone.
echo.
call npm run dev
pause
