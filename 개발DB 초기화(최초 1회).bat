@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/4] 개발용(서울) DB로 전환합니다...
copy /y .env.dev .env >nul
copy /y .env.dev .env.local >nul

echo [2/4] 스키마를 최신 상태로 반영합니다 (서울 DB의 기존 데이터는 지금 스키마 기준으로 초기화될 수 있습니다)...
call npx prisma db push --accept-data-loss --skip-generate
if errorlevel 1 (
  echo [ERROR] 스키마 반영 실패. 위 오류 메시지를 확인하세요.
  pause
  exit /b 1
)
call npx prisma generate

echo [3/4] 기본 카테고리/키워드 데이터를 채웁니다...
call node prisma\seed-launch.mjs

echo [4/4] 더미(테스트용) 기사 데이터를 채웁니다...
call node prisma\seed-dummy.mjs

echo.
echo 완료되었습니다. 이제 "사이트 열기.bat"으로 서버를 켜서 확인하세요.
echo (나중에 운영 DB로 다시 보고 싶으면 "운영DB로 전환.bat"을 실행하세요.)
pause
