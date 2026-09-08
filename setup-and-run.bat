@echo off
cd /d "%~dp0"

echo DATABASE_URL=file:./dev.db> .env
echo NEXTAUTH_SECRET=test-secret-for-local-only>> .env
echo NEXTAUTH_URL=http://localhost:3411>> .env
copy /y .env .env.local >nul

echo [1/4] npm install...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install failed. Is Node.js installed? Get it from https://nodejs.org
  pause
  exit /b 1
)

echo [2/4] applying database schema...
call npx prisma db push --accept-data-loss --skip-generate
call npx prisma generate

echo [3/4] seeding test data (an error here is fine if you already ran this before)...
call node prisma\seed.mjs
call node prisma\seed2.mjs
call node prisma\seed3.mjs

echo [4/4] starting server...
echo         Once you see "Ready" below, open http://localhost:3411 in your browser.
echo         Do not click inside this window - it will pause the server.
echo.
call npm run dev

pause
