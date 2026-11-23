$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$target = Join-Path $root 'mc\runtime\jre21'
$javaExe = Join-Path $target 'bin\java.exe'

if (Test-Path $javaExe) {
    Write-Host 'Java 21 zaten kurulu.'
    exit 0
}

$runtimeDir = Split-Path -Parent $target
$tmpDir = Join-Path $runtimeDir '_tmp'
$zip = Join-Path $env:TEMP 'blokarena-jre21.zip'
$url = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse'

Write-Host 'Java 21 indiriliyor (yaklasik 45 MB)...'
Invoke-WebRequest -Uri $url -OutFile $zip

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
if (Test-Path $tmpDir) { Remove-Item $tmpDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

Write-Host 'Zip aciliyor...'
Expand-Archive -Path $zip -DestinationPath $tmpDir -Force

$inner = Get-ChildItem -Path $tmpDir -Directory | Select-Object -First 1
if (-not $inner) { throw 'JRE paketi beklenen yapida degil.' }

if (Test-Path $target) { Remove-Item $target -Recurse -Force }
Move-Item -Path $inner.FullName -Destination $target

Remove-Item -Path $tmpDir -Recurse -Force
Remove-Item -Path $zip -Force

if (-not (Test-Path $javaExe)) { throw 'java.exe bulunamadi.' }
Write-Host 'Java 21 kuruldu.'
exit 0
