@echo off
:: ===================================================================
:: STOP RestoPOS - kills all running services
:: Use this only if you need to stop the app manually
:: (you can also just restart the computer)
:: ===================================================================

title Stopping RestoPOS...
color 0C

echo Stopping RestoPOS...

:: Kill by listening port (cleanest)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8001" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1

:: Kill cloudflared (remote tunnel)
taskkill /IM "cloudflared.exe" /F >nul 2>&1

:: Kill any orphan uvicorn processes
taskkill /IM "uvicorn.exe" /F >nul 2>&1

echo.
echo RestoPOS stopped.
echo MongoDB is still running (your data is safe).
echo.
echo To start again: double-click "RestoPOS" on your desktop.
echo.
timeout /t 4 >nul
