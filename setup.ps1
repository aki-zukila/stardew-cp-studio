$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = "C:\Users\zyq\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
$Pnpm = "C:\Users\zyq\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\pnpm.cmd"
$SharedNodeModules = "E:\Codex\zyq-portfolio\node_modules"

Push-Location $Root
if (!(Test-Path ".venv\Scripts\python.exe")) {
  & $Python -m venv .venv
}
& ".\.venv\Scripts\python.exe" -m pip install -r backend\requirements.txt

if (Test-Path "frontend\node_modules\vite") {
  Write-Host "Frontend dependencies already installed."
} elseif (Test-Path (Join-Path $SharedNodeModules "vite")) {
  Write-Host "Using shared frontend dependencies from $SharedNodeModules."
  $env:NODE_PATH = $SharedNodeModules
  Push-Location (Join-Path $Root "frontend")
  & "C:\Users\zyq\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (Join-Path $SharedNodeModules "vite\bin\vite.js") build --outDir dist
  Pop-Location
} else {
  $env:PNPM_HOME = Join-Path $Root ".pnpm-home"
  $env:PNPM_STORE_DIR = Join-Path $Root ".pnpm-store"
  $env:npm_config_cache = Join-Path $Root ".npm-cache"
  New-Item -ItemType Directory -Force $env:PNPM_HOME, $env:PNPM_STORE_DIR, $env:npm_config_cache | Out-Null
  & $Pnpm install --dir frontend --store-dir $env:PNPM_STORE_DIR
  & $Pnpm --dir frontend build
}
Pop-Location
