@echo off
cd /d "%~dp0"
echo Stopping any running dev server first...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Reinstalling npm packages (this can take a minute or two)...
call npm install
echo.
echo Done. Run start-site.bat to launch the server again.
pause
