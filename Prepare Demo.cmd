@echo off
cd /d "%~dp0"
echo One-time setup. Internet is needed only if packages or Redis are missing.
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 goto failed
)
call npm.cmd run demo:prepare
if errorlevel 1 goto failed
call npm.cmd run db:setup
if errorlevel 1 goto failed
call npm.cmd run build
if errorlevel 1 goto failed
echo.
echo Ready. Double-click Start Demo.cmd. Future demos work offline.
pause
exit /b 0
:failed
echo Setup stopped. Read the error above before trying again.
pause
exit /b 1
