<#
.SYNOPSIS
  Convenience launcher for Windows contributors. Boots the Bitby server and client dev environments
  in separate PowerShell windows so the full stack matches the Master Spec scaffolding.
.DESCRIPTION
  - Verifies that pnpm is available on PATH.
  - Automatically runs `pnpm install` if the workspace has not been bootstrapped yet.
  - Re-runs `pnpm install` when the lockfile hash changes to make sure new dependencies are linked.
  - Supports `-InstallDependencies` to force a fresh install even when dependencies exist.
  - Prebuilds the shared `@bitby/schemas` package so Vite can resolve workspace imports on cold clones.
  - Starts the schema TypeScript watcher (`pnpm --filter @bitby/schemas dev`).
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

function Get-PowerShellExecutable {
  $pwsh = Get-Command pwsh -ErrorAction SilentlyContinue
  if ($pwsh) {
    return $pwsh.Source
  }

  $windowsPowerShell = Get-Command powershell -ErrorAction SilentlyContinue
  if ($windowsPowerShell) {
    return $windowsPowerShell.Source
  }

  throw 'Unable to find PowerShell (pwsh) or Windows PowerShell on PATH. Install PowerShell 7 or ensure powershell.exe is available.'
}

function Test-DependenciesPresent {
  param(
    [string]$RepoRoot
  )

  $nodeModules = Join-Path $RepoRoot 'node_modules'
  $modulesMarker = Join-Path $nodeModules '.modules.yaml'

  return (Test-Path $nodeModules -PathType Container) -and (Test-Path $modulesMarker -PathType Leaf)
}

function Get-LockfileHash {
  param(
    [string]$RepoRoot
  )

  $lockfile = Join-Path $RepoRoot 'pnpm-lock.yaml'
  if (-not (Test-Path $lockfile -PathType Leaf)) {
    return $null
  }

  return (Get-FileHash -Path $lockfile -Algorithm SHA256).Hash
}

function Get-SavedLockfileHash {
  param(
    [string]$RepoRoot
  )

  $hashFile = Join-Path $RepoRoot 'node_modules/.pnpm-lock.hash'
  if (-not (Test-Path $hashFile -PathType Leaf)) {
    return $null
  }

  return (Get-Content -Path $hashFile -Raw -ErrorAction Stop).Trim()
}

function Save-LockfileHash {
  param(
    [string]$RepoRoot,
    [string]$Hash
  )

  if (-not $Hash) {
    return
  }

  $hashFile = Join-Path $RepoRoot 'node_modules/.pnpm-lock.hash'
  $nodeModulesPath = Split-Path -Parent $hashFile
  if (-not (Test-Path $nodeModulesPath -PathType Container)) {
    New-Item -ItemType Directory -Path $nodeModulesPath -Force | Out-Null
  }

  Set-Content -Path $hashFile -Value $Hash -Encoding UTF8
}

function Ensure-WorkspaceDependencies {
  param(
    [string]$RepoRoot,
    [switch]$Force
  )

  $dependenciesPresent = Test-DependenciesPresent -RepoRoot $RepoRoot
  $lockfileHash = Get-LockfileHash -RepoRoot $RepoRoot
  $savedLockfileHash = Get-SavedLockfileHash -RepoRoot $RepoRoot

  $requiresInstall = $Force -or -not $dependenciesPresent -or ($lockfileHash -and ($lockfileHash -ne $savedLockfileHash))

  if ($requiresInstall) {
    if ($Force) {
      Write-Host 'Forced dependency reinstall requested. Running pnpm install...' -ForegroundColor Cyan
    }
    elseif (-not $dependenciesPresent) {
      Write-Host 'Installing workspace dependencies with pnpm install...' -ForegroundColor Cyan
    }
    else {
      Write-Host 'Detected pnpm-lock.yaml changes. Reinstalling workspace dependencies...' -ForegroundColor Cyan
    }
    pnpm install --dir $RepoRoot
    if ($LASTEXITCODE -ne 0) {
      throw "pnpm install failed with exit code $LASTEXITCODE."
    }
    $updatedLockfileHash = Get-LockfileHash -RepoRoot $RepoRoot
    Save-LockfileHash -RepoRoot $RepoRoot -Hash $updatedLockfileHash
  }
  else {
    Write-Host 'Dependencies already present. Skipping pnpm install.' -ForegroundColor DarkGray
  }
}

function Invoke-ExternalCommand {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList
  )

  & $FilePath @ArgumentList
  if ($LASTEXITCODE -ne 0) {
    $joinedArgs = ($ArgumentList -join ' ')
    throw "Command '$FilePath $joinedArgs' failed with exit code $LASTEXITCODE."
  }
}

function Start-BitbyProcess {
  param(
    [string]$Title,
    [string]$Command,
    [string]$RepoRoot,
    [string]$ShellPath
  )

  Write-Host "Starting $Title..." -ForegroundColor Green
  Start-Process -FilePath $ShellPath -ArgumentList '-NoExit', '-Command', $Command -WorkingDirectory $RepoRoot
}

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$shellPath = Get-PowerShellExecutable

Assert-PnpmExists
Ensure-WorkspaceDependencies -RepoRoot $repoRoot -Force:$InstallDependencies

Write-Host 'Prebuilding shared schema package (@bitby/schemas)...' -ForegroundColor Cyan
Invoke-ExternalCommand -FilePath 'pnpm' -ArgumentList @('--dir', $repoRoot, '--filter', '@bitby/schemas', 'build')

Start-BitbyProcess -Title 'Bitby schemas (TypeScript watch)' -Command 'pnpm --filter @bitby/schemas dev' -RepoRoot $repoRoot -ShellPath $shellPath
Start-BitbyProcess -Title 'Bitby server (Fastify + WS)' -Command 'pnpm --filter @bitby/server dev' -RepoRoot $repoRoot -ShellPath $shellPath
Start-BitbyProcess -Title 'Bitby client (Vite)' -Command 'pnpm --filter @bitby/client dev' -RepoRoot $repoRoot -ShellPath $shellPath

Write-Host 'Schema watcher, server, and client processes launched. Check the new PowerShell windows for logs.' -ForegroundColor Yellow
