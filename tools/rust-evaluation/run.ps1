param(
    [ValidateSet('sqlx', 'diesel')][string]$Adapter = 'sqlx',

    [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$cargoCommand = Get-Command cargo -ErrorAction SilentlyContinue
$cargoPath = if ($cargoCommand) { $cargoCommand.Source } else { Join-Path $env:USERPROFILE '.cargo/bin/cargo.exe' }
Push-Location (Resolve-Path "$PSScriptRoot/../..")
try {
    $env:ZC_PREVIEW_DATABASE_URL = "postgres://zc_preview:local-preview-only@127.0.0.1:54329/zc_rust_$Adapter"
    $env:ZC_PREVIEW_PORT = if ($Adapter -eq 'sqlx') { '4310' } else { '4311' }
    $feature = "db-$Adapter"
    $target = "target/$Adapter"
    & $cargoPath build --locked --release -p zc-server -p zc-migrate --no-default-features --features $feature --target-dir $target
    if ($LASTEXITCODE) { throw 'Rust build failed' }
    if ($CheckOnly) { return }
    & "$target/release/zc-migrate.exe"
    if ($LASTEXITCODE) { throw 'Preview migrations failed; start the isolated database first' }
    & "$target/release/zc-server.exe"
    if ($LASTEXITCODE) { throw 'Preview server failed' }
} finally {
    Pop-Location
}
