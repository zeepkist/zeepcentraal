#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
adapter="${1:-sqlx}"
case "$adapter" in sqlx) port=4310 ;; diesel) port=4311 ;; *) echo 'Use sqlx or diesel' >&2; exit 2 ;; esac
export ZC_PREVIEW_DATABASE_URL="postgres://zc_preview:local-preview-only@127.0.0.1:54329/zc_rust_$adapter"
export ZC_PREVIEW_PORT="$port"
cargo build --locked --release -p zc-server -p zc-migrate --no-default-features --features "db-$adapter" --target-dir "target/$adapter"
"target/$adapter/release/zc-migrate"
exec "target/$adapter/release/zc-server"
