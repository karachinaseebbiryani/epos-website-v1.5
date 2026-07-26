@echo off
:: ===================================================================
:: STEP 3 - FOODPANDA 1 AND 2 AS SEPARATE TASKBAR WINDOWS
::
:: Run this ONCE. It creates two desktop shortcuts - "FoodPanda 1" and
:: "FoodPanda 2" - that each open the live-orders page signed into a
:: DIFFERENT partner account, side by side on the screen.
::
:: Two normal browser windows cannot do this: Chrome keeps one login
:: per website per profile, so both would show the same account. This
:: gives account 2 its own Chrome profile, which is the only thing
:: that actually keeps the two logins apart.
:: ===================================================================

title FoodPanda Windows Setup
color 0D
cd /d "%~dp0"

if not exist "%~dp0foodpanda-setup.ps1" (
  echo.
  echo   ERROR: foodpanda-setup.ps1 is missing from this folder.
  echo   Re-copy the windows-setup folder and try again.
  echo.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0foodpanda-setup.ps1"

if errorlevel 1 (
  echo.
  echo   Setup did not finish. Read the message above.
  echo.
  pause
)
