@echo off
title BLOKARENA MC Backend
cd /d "%~dp0.."
:loop
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 3010 -State Listen -ErrorAction SilentlyContinue) { exit 1 }"
if errorlevel 1 (
  timeout /t 15 /nobreak >nul
  goto loop
)
echo [%date% %time%] launcher backend baslatiliyor >> "%~dp0backend-loop.log"
"C:\Program Files\nodejs\node.exe" "launcher\server.cjs" >> "%~dp0backend-loop.log" 2>&1
echo [%date% %time%] launcher backend durdu, 3 sn sonra yeniden baslatilacak >> "%~dp0backend-loop.log"
timeout /t 3 /nobreak >nul
goto loop
