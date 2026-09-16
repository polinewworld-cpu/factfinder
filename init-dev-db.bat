@echo off
cd /d "%~dp0"

echo [1/4] Switching to DEV (Seoul) database...
copy /y .env.dev .env >nul
copy /y .env.dev .env.local >nul

echo [2/4] Pushing current schema to the dev database (existing data there may be reset)...
call npx prisma db push --accept-data-loss --skip-generate
if errorlevel 1 (
  echo [ERROR] Schema push failed. See the message above.
  pause
  exit /b 1
)
call npx prisma generate

echo [3/4] Seeding base categories/keywords...
call node prisma\seed-launch.mjs

echo [4/4] Seeding dummy articles...
call node prisma\seed-dummy.mjs

echo.
echo Done. Run start-site.bat to launch the server and check it out.
echo (To view real production data later, run switch-to-prod-db.bat.)
pause
