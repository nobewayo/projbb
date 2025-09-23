@echo off
setlocal EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "POWERSHELL_EXE="

where pwsh.exe >NUL 2>&1
if !ERRORLEVEL! EQU 0 (
  set "POWERSHELL_EXE=pwsh"
) else (
  where powershell.exe >NUL 2>&1
  if !ERRORLEVEL! EQU 0 (
    set "POWERSHELL_EXE=powershell"
  ) else (
    echo Could not locate PowerShell (pwsh.exe or powershell.exe) on PATH.
    exit /b 1
  )
)

"%POWERSHELL_EXE%" -ExecutionPolicy Bypass -NoLogo -File "%SCRIPT_DIR%start-windows.ps1" %*
endlocal
