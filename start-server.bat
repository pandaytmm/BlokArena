@echo off
title BLOKARENA Sunucu
cd /d "%~dp0"
wscript "%~dp0launcher\ensure-backend.vbs"
:loop
echo [%date% %time%] sunucu baslatiliyor >> server.log
"C:\Program Files\nodejs\node.exe" server.js >> server.log 2>&1
echo [%date% %time%] sunucu durdu, 3 sn sonra yeniden baslatilacak >> server.log
timeout /t 3 /nobreak >nul
goto loop
