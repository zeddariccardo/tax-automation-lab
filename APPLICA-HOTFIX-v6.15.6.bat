@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "REPO=%~1"
if not defined REPO (
  echo.
  echo TAX AUTOMATION LAB - HOTFIX v6.15.6
  echo Incolla il percorso completo della cartella locale del repository tax-automation-lab.
  echo Esempio: C:\Users\Nome\Documents\tax-automation-lab
  set /p "REPO=Percorso repository: "
)
if not defined REPO (
  echo Percorso non indicato.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-hotfix-v6.15.6.ps1" -RepositoryRoot "%REPO%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo Hotfix non applicata. Leggi l'errore sopra.
  pause
  exit /b %RC%
)
echo Operazione completata. Ora controlla git diff, poi esegui commit e push.
pause
exit /b 0
