param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
$cargoPath = if ($cargoCommand) { $cargoCommand.Source } else { Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe' }
Push-Location (Resolve-Path "$PSScriptRoot/../..")
try {
    $env:ZC_PREVIEW_DATABASE_URL = 'postgres://zc_preview:local-preview-only@127.0.0.1:54329/zc_rust_sqlx'
    $env:ZC_PREVIEW_PORT = '4310'
    & $cargoPath build --locked --release -p zc-http-benchmark
    if ($LASTEXITCODE) { throw 'Rust build failed' }
    if ($CheckOnly) { return }
    & 'target/release/zc-http-benchmark.exe'
    if ($LASTEXITCODE) { throw 'Preview server failed' }
} finally {
    Pop-Location
}
