param([ValidateSet('sqlx', 'diesel')][string]$Adapter = 'sqlx')
$ErrorActionPreference = 'Stop'
$cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
$cargoPath = if ($cargoCommand) { $cargoCommand.Source } else { Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe' }
Push-Location (Resolve-Path "$PSScriptRoot/../..")
try {
    $env:ZC_PREVIEW_DATABASE_URL = "postgres://zc_preview:local-preview-only@127.0.0.1:54329/zc_rust_$Adapter"
    & $cargoPath test --locked -p zc-database --no-default-features --features "db-$Adapter" --test preview -- --ignored
    if ($LASTEXITCODE) { throw 'Database contract failed' }
} finally { Pop-Location }
