@echo off
chcp 65001 >nul
title FactFinder 로컬 서버
cd /d "%~dp0"

echo 서버를 시작합니다. 준비되면 브라우저가 자동으로 열립니다.
echo 이 창 안을 클릭하지 마세요 (클릭하면 서버가 일시정지됩니다).
echo.

start "wait" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:3411';$n=0;while($n -lt 120){try{$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 1;if($r.StatusCode -eq 200){Start-Process $u;break}}catch{};Start-Sleep -Seconds 1;$n++}"

call npm run dev

pause
