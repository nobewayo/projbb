<#
.SYNOPSIS
  Convenience launcher for Windows contributors. Boots the Bitby server and client dev environments
  in separate PowerShell windows so the full stack matches the Master Spec scaffolding.
.DESCRIPTION
  - Verifies that pnpm is available on PATH.
  - Optionally runs `pnpm install` when invoked with `-InstallDependencies`.
  - Starts the Fastify server (`pnpm --filter @bitby/server dev`).
  - Starts the Vite client shell (`pnpm --filter @bitby/client dev`).
  Each process inherits its own window to preserve readable logs per spec §18 observability guidance.
.PARAMETER InstallDependencies
  Runs `pnpm install` before launching dev servers.
.EXAMPLE
  ./start-windows.ps1 -InstallDependencies
#>
[CmdletBinding()]
param(
  [switch]$InstallDependencies
)

$ErrorActionPreference = 'Stop'

function Assert-PnpmExists {
  if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw 'pnpm was not found on PATH. Install pnpm (npm install -g pnpm) before running this script.'
  }
}

function Invoke-WorkspaceInstall {
  param(
    [string]$RepoRoot
  )

  Write-Host 'Installing workspace dependencies with pnpm install...' -ForegroundColor Cyan
  pnpm install --dir $RepoRoot
}

function Start-BitbyProcess {
  param(
    [string]$Title,
    [string]$Command,
    [string]$RepoRoot
  )

  $escapedRoot = $RepoRoot.Replace('`', '``')
  $fullCommand = "Set-Location `\"$escapedRoot`\"; $Command"

  Write-Host "Starting $Title..." -ForegroundColor Green
  Start-Process -FilePath pwsh -ArgumentList '-NoExit', '-Command', $fullCommand -WorkingDirectory $RepoRoot
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Assert-PnpmExists

if ($InstallDependencies) {
  Invoke-WorkspaceInstall -RepoRoot $repoRoot
}

Start-BitbyProcess -Title 'Bitby server (Fastify + WS)' -Command 'pnpm --filter @bitby/server dev' -RepoRoot $repoRoot
Start-BitbyProcess -Title 'Bitby client (Vite)' -Command 'pnpm --filter @bitby/client dev' -RepoRoot $repoRoot

Write-Host 'Server and client processes launched. Check the new PowerShell windows for logs.' -ForegroundColor Yellow
