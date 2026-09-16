@echo off
cd /d "%~dp0"
echo Applying current Prisma schema to whichever DB .env.local currently points to...
echo Stopping any running dev server first, so the Prisma client file is not locked...
taskkill /F /IM node.exe >nul 2>&1
call npx prisma generate
call npx prisma db push
echo.
echo Done. Restart the dev server (start-site.bat) to pick up the changes.
pause
