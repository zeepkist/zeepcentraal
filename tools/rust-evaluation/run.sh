#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
export ZC_PREVIEW_DATABASE_URL="postgres://zc_preview:local-preview-only@127.0.0.1:54329/zc_rust_sqlx"
export ZC_PREVIEW_PORT=4310
cargo build --locked --release -p zc-http-benchmark
exec target/release/zc-http-benchmark
