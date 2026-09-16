@echo off
title FactFinder Local Server
cd /d "%~dp0"

echo Starting the server. The browser will open automatically once ready.
echo Do NOT click inside this window - clicking pauses the server.
echo.

start "wait" /min powershell -NoProfile -WindowStyle Hidden -Command "$u='http://localhost:3411';$n=0;while($n -lt 120){try{$r=Invoke-WebRequest -Uri $u -UseBasicParsing -TimeoutSec 1;if($r.StatusCode -eq 200){Start-Process $u;break}}catch{};Start-Sleep -Seconds 1;$n++}"

call npm run dev

pause
