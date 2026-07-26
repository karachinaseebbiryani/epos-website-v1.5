@echo off
:: ===================================================================
:: STEP 4 - ONE-CLICK "KNB LOGIN" DESKTOP ICON
::
:: Run this ONCE on the computer where the owner signs in. It puts a
:: big red "K" icon on the Desktop that opens the admin login page in
:: its own window. Sign in once, let Chrome SAVE the password, and
:: after that it fills in automatically - only the red Sign In button
:: needs clicking.
:: ===================================================================

title KNB Login Shortcut Setup
color 0C
cd /d "%~dp0"

if not exist "%~dp0login-shortcut-setup.ps1" (
  echo.
  echo   ERROR: login-shortcut-setup.ps1 is missing from this folder.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0login-shortcut-setup.ps1"

if errorlevel 1 (
  echo.
  echo   Setup did not finish. Read the message above.
  echo.
  pause
)
