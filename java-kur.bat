@echo off
setlocal
cd /d "%~dp0"
title BlokArena - Java 21 Kurulumu

if exist "mc\runtime\jre21\bin\java.exe" (
    echo Java 21 zaten kurulu. Devam edebilirsin.
    pause
    exit /b 0
)

echo Java 21 indiriliyor, lutfen bekle...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\java-kur.ps1"
if errorlevel 1 goto fail

if exist "mc\runtime\jre21\bin\java.exe" (
    echo.
    echo Kurulum tamamlandi. Sirada launcher var: launcher\open-launcher.vbs
    echo Bu pencereyi kapatabilirsin.
    pause
    exit /b 0
)

:fail
echo.
echo Kurulum basarisiz. Internet baglantisini kontrol edip tekrar dene.
echo Alternatif: https://adoptium.net adresinden JRE 21 indirip mc\runtime\jre21 klasorune cikar.
pause
exit /b 1
