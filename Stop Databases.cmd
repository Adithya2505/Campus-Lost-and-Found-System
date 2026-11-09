@echo off
cd /d "%~dp0"
echo First stop the website with Ctrl+C in its window.
call npm.cmd run demo:stop
pause
