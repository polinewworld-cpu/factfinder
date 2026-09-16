@echo off
cd /d "%~dp0"
echo Granting CHIEF_EDITOR role to polinewworld@gmail.com on the database currently in .env.local ...
call node prisma\set-chief-editor.mjs
echo.
echo Done. Log out and log back in (Test Login) with polinewworld@gmail.com to refresh your session.
pause
