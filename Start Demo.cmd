@echo off
cd /d "%~dp0"
if not exist .env (
  echo Run Prepare Demo.cmd once first.
  pause
  exit /b 1
)
if not exist .next\BUILD_ID (
  echo Run Prepare Demo.cmd once first to build the application.
  pause
  exit /b 1
)
call npm.cmd run demo:services
if errorlevel 1 goto failed
echo.
echo Open http://127.0.0.1:3000 in your browser.
echo Keep this window open. Press Ctrl+C here when finished.
echo.
call npm.cmd start
goto end
:failed
echo Could not start. See the error above.
pause
:end
