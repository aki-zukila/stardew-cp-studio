$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Push-Location $Root
if (!(Test-Path ".venv\Scripts\python.exe")) {
  throw "Please run setup.ps1 first."
}
if (!(Test-Path "frontend\dist\index.html")) {
  & "$Root\setup.ps1"
}

& "$Root\.venv\Scripts\python.exe" "$Root\start_server.py"
Pop-Location
