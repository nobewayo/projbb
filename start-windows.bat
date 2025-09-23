@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_EXE="

where pwsh.exe >NUL 2>&1
if errorlevel 1 goto UseWindowsPowerShell
set "POWERSHELL_EXE=pwsh"
goto RunPowerShell

:UseWindowsPowerShell
where powershell.exe >NUL 2>&1
if errorlevel 1 goto PowerShellNotFound
set "POWERSHELL_EXE=powershell"
goto RunPowerShell

:PowerShellNotFound
echo Could not locate PowerShell (pwsh.exe or powershell.exe) on PATH.
exit /b 1

:RunPowerShell
"%POWERSHELL_EXE%" -ExecutionPolicy Bypass -NoLogo -File "%SCRIPT_DIR%start-windows.ps1" %*
endlocal
