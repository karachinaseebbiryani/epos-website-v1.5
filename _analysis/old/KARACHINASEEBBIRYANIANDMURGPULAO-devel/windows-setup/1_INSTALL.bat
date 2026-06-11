@echo off
:: ===================================================================
:: STEP 1 - ONE-TIME INSTALLATION (Windows)
:: Run this ONCE the first time. After it finishes, use the
:: "RestoPOS" desktop shortcut every day.
:: ===================================================================

setlocal EnableDelayedExpansion
title RestoPOS - First Time Setup
color 0A
cd /d "%~dp0\.."
set "PROJECT_DIR=%cd%"
set "SETUP_DIR=%~dp0"

echo.
echo ============================================================
echo KARACHI NASEEB BIRYANI AND MURG PULAO
echo RestoPOS First Time Setup
echo ============================================================
echo.
echo This installs everything needed to run RestoPOS.
echo Only needs to run ONCE on this computer.
echo Takes 5-10 minutes depending on internet speed.
echo.
pause
echo.

:: ===========================
:: [1/6] Check Python
:: ===========================
echo [1/6] Checking Python...
python --version >nul 2>&1
if errorlevel 1 goto NO_PYTHON

for /f "tokens=2" %%v in ('python --version 2^>^&1') do set "PYVER=%%v"
echo   Found Python %PYVER%

:: Extract major.minor so we can warn about bleeding-edge versions
for /f "tokens=1,2 delims=." %%a in ("%PYVER%") do (
  set "PYMAJ=%%a"
  set "PYMIN=%%b"
)

:: Python 3.13+ often lacks prebuilt wheels for bcrypt/pydantic. Warn user.
if %PYMAJ%==3 (
  if %PYMIN% GEQ 13 (
    echo.
    echo   WARNING: You have Python %PYVER%. This is very new and some
    echo   packages may not have prebuilt Windows wheels yet.
    echo.
    echo   If the install fails, please install Python 3.12 instead:
    echo     https://www.python.org/downloads/release/python-3128/
    echo.
    choice /C YN /M "Continue with Python %PYVER%? (Y/N)"
    if errorlevel 2 (
      echo.
      echo Install Python 3.12, then re-run 1_INSTALL.bat.
      pause
      exit /b 1
    )
  )
)
echo OK
echo.
goto CHECK_NODE

:NO_PYTHON
echo.
echo ============================================================
echo ERROR: Python is not installed.
echo ============================================================
echo.
echo How to fix:
echo 1. Open: https://www.python.org/downloads/release/python-3128/
echo 2. Download Python 3.12 for Windows (recommended, most compatible)
echo 3. Run the installer
echo 4. IMPORTANT: tick "Add Python to PATH" on the first screen
echo 5. Click Install Now
echo 6. Restart this computer
echo 7. Run 1_INSTALL.bat again.
echo.
pause
exit /b 1

:: ===========================
:: [2/6] Check Node.js
:: ===========================
:CHECK_NODE
echo [2/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 goto NO_NODE
echo OK
echo.
goto CHECK_MONGO

:NO_NODE
echo.
echo ============================================================
echo ERROR: Node.js is not installed.
echo ============================================================
echo.
echo 1. Open: https://nodejs.org/
echo 2. Download the LTS version for Windows
echo 3. Run the installer (accept defaults)
echo 4. Restart this computer
echo 5. Run 1_INSTALL.bat again.
echo.
pause
exit /b 1

:: ===========================
:: [3/6] Check MongoDB
:: ===========================
:CHECK_MONGO
echo [3/6] Checking MongoDB...
powershell -NoProfile -Command "try{(New-Object System.Net.Sockets.TcpClient('localhost',27017)).Close();exit 0}catch{exit 1}" >nul 2>&1
if errorlevel 1 goto NO_MONGO
echo OK
echo.
goto WRITE_ENV

:NO_MONGO
echo.
echo ============================================================
echo WARNING: MongoDB is not running on port 27017.
echo ============================================================
echo.
echo 1. Open: https://www.mongodb.com/try/download/community
echo 2. Run the MSI installer - choose "Complete" install
echo 3. CHECK: "Install MongoDB as a Service"
echo 4. Restart the computer
echo.
choice /C YN /M "Continue setup anyway? (Y/N)"
if errorlevel 2 (pause & exit /b 1)
echo Continuing...
echo.

:: ===========================
:: [4/6] Create config files
:: ===========================
:WRITE_ENV
echo [4/6] Creating config files...

:: Generate a random JWT secret (hex only - safe for .env file and cmd)
for /f %%i in ('powershell -NoProfile -Command "[Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')" 2^>nul') do set "JWT=%%i"
if "%JWT%"=="" set "JWT=kn_biryani_change_me_to_a_long_random_secret_string_2026"

if not exist "%PROJECT_DIR%\backend\.env" (
  > "%PROJECT_DIR%\backend\.env" echo MONGO_URL=mongodb://localhost:27017
  >>"%PROJECT_DIR%\backend\.env" echo DB_NAME=restopos_db
  >>"%PROJECT_DIR%\backend\.env" echo CORS_ORIGINS=*
  >>"%PROJECT_DIR%\backend\.env" echo JWT_SECRET=%JWT%
  >>"%PROJECT_DIR%\backend\.env" echo ADMIN_EMAIL=admin@restaurant.com
  >>"%PROJECT_DIR%\backend\.env" echo ADMIN_PASSWORD=admin123
  >>"%PROJECT_DIR%\backend\.env" echo FRONTEND_URL=http://localhost:8001
  >>"%PROJECT_DIR%\backend\.env" echo EMERGENT_LLM_KEY=
  echo   - backend\.env created
) else (
  echo   - backend\.env already exists, keeping it
)

if not exist "%PROJECT_DIR%\frontend\.env" (
  > "%PROJECT_DIR%\frontend\.env" echo REACT_APP_BACKEND_URL=
  >>"%PROJECT_DIR%\frontend\.env" echo WDS_SOCKET_PORT=3000
  >>"%PROJECT_DIR%\frontend\.env" echo GENERATE_SOURCEMAP=false
  echo   - frontend\.env created
) else (
  echo   - frontend\.env already exists, keeping it
)
echo OK
echo.

:: ===========================
:: [5/6] Backend packages
:: ===========================
echo [5/6] Installing backend packages... (2-3 minutes)
cd /d "%PROJECT_DIR%\backend"
python -m pip install --upgrade pip >nul 2>&1

:: Install only prebuilt wheels (no source builds = no Rust/MSVC headaches)
echo   - Installing core packages (prebuilt wheels only)...
python -m pip install --only-binary=:all: --prefer-binary fastapi "uvicorn[standard]" motor pymongo python-dotenv bcrypt pyjwt python-multipart apscheduler pytz httpx pydantic
if errorlevel 1 (
  echo   - Prebuilt-only install failed, trying normal install...
  python -m pip install fastapi "uvicorn[standard]" motor pymongo python-dotenv bcrypt pyjwt python-multipart apscheduler pytz httpx pydantic
  if errorlevel 1 goto BACKEND_FAIL
)

:: Voice Assistant (optional - needs special index)
echo   - Installing Voice Assistant support (optional)...
python -m pip install emergentintegrations --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/ >nul 2>&1
if errorlevel 1 (
  echo     ^(skipped - voice assistant will be disabled, rest of POS still works^)
) else (
  echo     Voice Assistant installed
)
echo OK
echo.
goto FRONTEND_INSTALL

:BACKEND_FAIL
echo.
echo ============================================================
echo ERROR: Backend package install failed.
echo ============================================================
echo.
echo Most likely cause: you have a very new Python version
echo ^(3.13 or 3.14^) which doesn't have prebuilt wheels for some
echo packages yet.
echo.
echo HOW TO FIX:
echo   1. Install Python 3.12 instead:
echo      https://www.python.org/downloads/release/python-3128/
echo   2. TICK "Add Python to PATH" during install
echo   3. If you had another Python: uninstall it first
echo      ^(Settings ^> Apps ^> find "Python 3.14" ^> Uninstall^)
echo   4. Run 1_INSTALL.bat again
echo.
pause
exit /b 1

:: ===========================
:: [6/6] Frontend packages + build
:: ===========================
:FRONTEND_INSTALL
echo [6/6] Installing frontend and building... (3-5 minutes)
cd /d "%PROJECT_DIR%\frontend"
call npm install -g yarn >nul 2>&1

call yarn install
if errorlevel 1 goto FRONTEND_FAIL

echo   - Building frontend (one-time, ~2 minutes)...
set "CI=false"
set "GENERATE_SOURCEMAP=false"
call yarn build
if errorlevel 1 goto FRONTEND_FAIL
echo OK
echo.
goto MAKE_SHORTCUT

:FRONTEND_FAIL
echo.
echo ERROR: Frontend install failed. Check your internet connection
echo and try running 1_INSTALL.bat again.
echo.
pause
exit /b 1

:: ===========================
:: Create desktop shortcut
:: ===========================
:MAKE_SHORTCUT
echo Creating desktop shortcut...
> "%TEMP%\mkshortcut.vbs" echo Set oWS = WScript.CreateObject("WScript.Shell")
>>"%TEMP%\mkshortcut.vbs" echo sLinkFile = oWS.SpecialFolders("Desktop") ^& "\RestoPOS.lnk"
>>"%TEMP%\mkshortcut.vbs" echo Set oLink = oWS.CreateShortcut(sLinkFile)
>>"%TEMP%\mkshortcut.vbs" echo oLink.TargetPath = "wscript.exe"
>>"%TEMP%\mkshortcut.vbs" echo oLink.Arguments = """%SETUP_DIR%2_START_RestoPOS.vbs"""
>>"%TEMP%\mkshortcut.vbs" echo oLink.WorkingDirectory = "%SETUP_DIR%"
>>"%TEMP%\mkshortcut.vbs" echo oLink.Description = "KARACHI NASEEB BIRYANI - RestoPOS"
>>"%TEMP%\mkshortcut.vbs" echo oLink.IconLocation = "shell32.dll,170"
>>"%TEMP%\mkshortcut.vbs" echo oLink.Save
cscript //nologo "%TEMP%\mkshortcut.vbs" >nul 2>&1
del "%TEMP%\mkshortcut.vbs" >nul 2>&1
echo OK
echo.

:: ===========================
:: Done!
:: ===========================
echo ============================================================
echo SETUP COMPLETE!
echo ============================================================
echo.
echo To start RestoPOS:
echo   Double-click "RestoPOS" on your DESKTOP
echo.
echo Login: admin@restaurant.com / admin123
echo.
echo Press any key to close.
pause >nul
exit /b 0
