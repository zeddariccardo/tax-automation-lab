@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "REPO=%~1"
if not defined REPO (
  echo Incolla il percorso completo della cartella locale del repository tax-automation-lab.
  set /p "REPO=Percorso repository: "
)
if not defined REPO exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-hotfix-v6.15.6.ps1" -RepositoryRoot "%REPO%" -Rollback
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
