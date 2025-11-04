@echo off
chcp 65001 >nul
setlocal

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
set "APP=%~dp0app.py"
set "ACT=%ROOT%\.venv\Scripts\activate.bat"
set "PY=%ROOT%\.venv\Scripts\python.exe"
set "PORT=7861"

if exist "%ACT%" (
  call "%ACT%"
) else (
  echo [WARN] No se encontro venv; usare Python del sistema...
  set "PY=python"
)

set PORT=%PORT%
start "" /b "%PY%" "%APP%"
timeout /t 1 >nul
start "" "http://127.0.0.1:%PORT%/"

echo (Cierra esta ventana cuando termines)



