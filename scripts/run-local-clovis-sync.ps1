$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$node = 'C:\Users\felix\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$env:NODE_PATH = 'C:\Users\felix\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$logDirectory = Join-Path $env:LOCALAPPDATA 'ZipCodes'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
& $node (Join-Path $PSScriptRoot 'local-clovis-sync.cjs') *>&1 |
  Tee-Object -FilePath (Join-Path $logDirectory 'clovis-sync.log') -Append
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
