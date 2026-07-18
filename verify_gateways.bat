@echo off
REM Verify SafePay gateway changes: backend compile + frontend build
set PY=C:\Users\Jabran Ahmad Hanjra\AppData\Local\Programs\Python\Python312\python.exe

echo === 1/2 BACKEND py_compile ===
cd /d D:\epos-website-v1.5\backend
"%PY%" -m py_compile server.py && echo BACKEND: OK || echo BACKEND: FAILED

echo.
echo === 2/2 FRONTEND yarn build ===
cd /d D:\epos-website-v1.5\frontend
set CI=false
set GENERATE_SOURCEMAP=false
call yarn build && echo FRONTEND: OK || echo FRONTEND: FAILED

echo.
pause
