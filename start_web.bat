@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo   Raiden Shogun - Asistente Virtual
echo ========================================
echo.

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
set "APP=%~dp0app.py"
set "ACT=%ROOT%\.venv\Scripts\activate.bat"
set "PY=%ROOT%\.venv\Scripts\python.exe"
set "PORT=7861"

REM Verificar si existe el entorno virtual
if exist "%ACT%" (
  echo [OK] Entorno virtual encontrado
  call "%ACT%"
) else (
  echo [AVISO] No se encontro entorno virtual
  echo Buscando Python del sistema...

  REM Verificar si Python esta disponible en el PATH
  where python >nul 2>&1
  if %errorlevel% neq 0 (
    echo.
    echo ============================================
    echo   ERROR: Python no esta instalado o no
    echo   esta agregado al PATH del sistema
    echo ============================================
    echo.
    echo Por favor instala Python 3.8 o superior desde:
    echo https://www.python.org/downloads/
    echo.
    echo IMPORTANTE: Durante la instalacion marca la opcion:
    echo [X] Add Python to PATH
    echo.
    echo Presiona cualquier tecla para cerrar...
    pause >nul
    exit /b 1
  )

  echo [OK] Python del sistema encontrado
  set "PY=python"
)

REM Verificar que el archivo app.py existe
if not exist "%APP%" (
  echo.
  echo [ERROR] No se encontro el archivo app.py
  echo Ruta esperada: %APP%
  echo.
  pause
  exit /b 1
)

echo.
echo Iniciando aplicacion en el puerto %PORT%...
echo.

set PORT=%PORT%
start "" /b "%PY%" "%APP%"
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/"

echo.
echo ========================================
echo   Aplicacion iniciada correctamente
echo   URL: http://127.0.0.1:%PORT%/
echo ========================================
echo.
echo (Cierra esta ventana cuando termines)



