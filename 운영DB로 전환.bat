@echo off
chcp 65001 >nul
cd /d "%~dp0"
copy /y .env.production .env >nul
copy /y .env.production .env.local >nul
echo 운영(오하이오) DB로 전환했습니다.
echo 주의: 이 상태에서는 글쓰기/댓글 등 쓰기 테스트를 하면 실제 운영 데이터에 그대로 기록됩니다.
pause
