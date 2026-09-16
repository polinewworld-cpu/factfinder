@echo off
chcp 65001 >nul
cd /d "%~dp0"
copy /y .env.dev .env >nul
copy /y .env.dev .env.local >nul
echo 개발용(서울) DB로 전환했습니다. 이제 "사이트 열기.bat"으로 서버를 켜세요.
pause
