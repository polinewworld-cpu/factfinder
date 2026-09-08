@echo off
cd /d "%~dp0"

if not exist .env (
  echo DATABASE_URL=file:./dev.db> .env
  echo NEXTAUTH_SECRET=test-secret-for-local-only>> .env
  echo NEXTAUTH_URL=http://localhost:3411>> .env
  copy /y .env .env.local >nul
)

echo Applying database schema...
call npx prisma db push --accept-data-loss --skip-generate
call npx prisma generate

echo.
echo Seeding test data (an error here is fine if you already ran this before)...
call node prisma\seed.mjs
call node prisma\seed2.mjs
call node prisma\seed3.mjs

echo.
echo Done. Now double-click start-server.bat and open http://localhost:3411
pause
