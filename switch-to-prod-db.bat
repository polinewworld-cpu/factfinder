@echo off
cd /d "%~dp0"
copy /y .env.production .env >nul
copy /y .env.production .env.local >nul
echo Switched to PRODUCTION (Ohio) database.
echo WARNING: any write actions (posting, commenting, etc.) now affect real production data.
pause
