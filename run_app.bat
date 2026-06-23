@echo off
setlocal
cd /d "%~dp0"
echo Stardew CP Studio is starting...
echo If another old window is still open, close it to avoid using an outdated page.
echo.
if not exist ".venv\Scripts\python.exe" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
)
if not exist "frontend\dist\index.html" (
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
)
".venv\Scripts\python.exe" "%~dp0start_server.py"
if errorlevel 1 (
  echo.
  echo Startup failed. Please check logs\latest-log.txt.
  pause
)
endlocal
