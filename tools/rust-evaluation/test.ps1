$ErrorActionPreference = 'Stop'
$cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
$cargoPath = if ($cargoCommand) { $cargoCommand.Source } else { Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe' }
Push-Location (Resolve-Path "$PSScriptRoot/../..")
try {
    & $cargoPath test --locked -p zc-http-benchmark
    if ($LASTEXITCODE) { throw 'HTTP benchmark contract failed' }
} finally { Pop-Location }
