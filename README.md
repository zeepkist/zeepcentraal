# ZeepCentraal (V3)

A Bun workspace monorepo for ZeepCentraal services.

## What This Repository Is

- A modular API backend built with Elysia and Bun.
- A PostgreSQL-backed data layer using Drizzle ORM.
- A background processing system using pgmq for durable fast/bulk queues and Bun.cron for recurring schedules.

## Workspace Layout

- `packages/core`: shared config, auth, errors, integrations, and utility primitives.
- `packages/database`: Drizzle schema, migrations, and data services.
- `packages/server`: HTTP API process (Elysia routes and plugins).
- `packages/jobs`: background worker process (Bun SQL + pgmq tasks + elected cron scheduler).
- `packages/workshop`: Steam metadata, SteamCMD downloads, parsing, and workshop reconciliation.

## Prerequisites

Before you start, install:

- Bun (latest stable): https://bun.sh
- PostgreSQL (running locally or remotely and reachable from `DATABASE_URL`)
- Git
- Docker (optional, only needed for container builds/runs)
- SteamCMD (only needed when running workshop jobs outside Docker)

## Quick Start

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd zeepcentraal
bun install
```

### 2. Create environment file

macOS/Linux:

```bash
cp .env.example .env
```

PowerShell:

```powershell
Copy-Item .env.example .env
```

### 3. Configure required environment values

At minimum, set these values in `.env`:

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `TRIGGER_JOB_TOKEN` | Yes | Token used for protected job trigger endpoints |
| `JWT_SECRET` | Yes | Must be at least 32 characters |
| `CORS_ALLOWED_ORIGINS` | No | Comma-separated website origins; defaults to `FRONTEND_URL` |
| `TRUST_PROXY` | No | Trust forwarded client IP headers for rate limiting |
| `DATABASE_POOL_MAX` | No | Application database partition; server defaults to `5`, jobs to `8` |
| `JOBS_QUEUE_POOL_MAX` | No | Reserved queue database partition; defaults to `2` |
| `DATABASE_CONNECT_TIMEOUT_MS` | No | Pool acquisition/connect timeout; defaults to `5000` |
| `DATABASE_STATEMENT_TIMEOUT_MS` | No | PostgreSQL statement timeout; server defaults to `15000`, jobs to `300000` |
| `DATABASE_LOCK_TIMEOUT_MS` | No | PostgreSQL lock timeout; server defaults to `3000`, jobs to `30000` |
| `DATABASE_IDLE_TRANSACTION_TIMEOUT_MS` | No | Idle transaction timeout; server defaults to `30000`, jobs to `60000` |

The remaining values in `.env.example` are optional or have defaults, but you should configure them for your environment (Steam, Discord, Wasabi/S3, and OpenTelemetry).

### 4. Apply database migrations

```bash
bun run db:migrate
```

If you changed schema and need to generate new migrations first:

```bash
bun run db:generate
bun run db:migrate
```

### 5. Start local development processes

Run API and jobs in separate terminals.

Terminal 1 (API):

```bash
bun run dev:server
```

Terminal 2 (jobs):

```bash
bun run dev:jobs
```

Health check:

```bash
curl http://localhost:3000/healthz
```

Expected response:

```json
{"status":"ok"}
```

## Development Commands

Run Rust services from PowerShell on Windows:

```powershell
$env:CARGO_INCREMENTAL = '0'
$env:CARGO_PROFILE_DEV_DEBUG = '0'
$env:CARGO_TARGET_DIR = Join-Path $env:TEMP 'zc-rust-target'
cargo run --locked -p zc-server --bin zeepcentraal-server
# In another PowerShell session:
cargo run --locked -p zc-jobs --bin zeepcentraal-jobs
```

Rust loads local `.env` automatically. Production uses process environment. Remaining Bun commands
serve PostGraphile and web; older Bun backend commands remain for comparison and rollback.

| Command | What it does |
| --- | --- |
| `bun run dev:server` | Starts API in watch mode |
| `bun run dev:jobs` | Starts jobs worker in watch mode |
| `bun run db:studio` | Opens Drizzle Studio |
| `bun run db:generate` | Generates Drizzle migrations |
| `bun run db:migrate` | Applies pending migrations |
| `bun run typecheck` | Runs TypeScript type check |
| `bun run test` | Runs test suite |
| `bun run lint` | Runs Biome checks |
| `bun run lint:fix` | Applies Biome autofixes |
| `bun run lint:staged` | Applies Biome fixes to staged files |
| `bun run build:server` | Compiles server binary to `dist/` |
| `bun run build:jobs` | Compiles jobs binary to `dist/` |

## Releases

Pushes to `develop` run Rust and retained TypeScript checks, build service binaries, preflight
Docker images, then publish independent semantic releases. Rust images start at `3.0.0` and use
`zc-server`, `zc-jobs`, `zc-migrate`, `zc-lobby-host`, `zc-discord`, `zc-inspector-zeep`, and
`zc-import-zsl` tags such as `zc-server@3.0.0`. PostGraphile and web share root releases starting
at `3.0.1` because historical root `3.0.0` is already in use. Their image names remain
`postgraphile` and `web`. Release versions are stamped into Rust build checkouts; source Cargo
manifests remain at baseline `3.0.0`.

Release tooling lives in `scripts/release/*.mjs`. `node scripts/release/plan.mjs <output.json>`
plans tags and images; CI alone runs `publish.mjs`. Conventional `feat`, `fix`, `perf`, and breaking
commits drive versions for affected crates and retained TypeScript services. Shared Rust crate,
Cargo lockfile, and migration changes release affected Rust binaries.

## Git Hooks

`bun install` configures native Git hooks from `.githooks` through local `core.hooksPath`. Before
each commit the pre-commit hook applies Biome fixes to staged files, then runs the full typecheck
and test suite. Use `git commit --no-verify` only when an emergency bypass is required.

## Build and Docker

Build local Rust binaries from PowerShell:

```powershell
$env:CARGO_INCREMENTAL = '0'
$env:CARGO_TARGET_DIR = Join-Path $env:TEMP 'zc-rust-target'
cargo build --locked --release -p zc-server -p zc-jobs -p zc-migrate -p zc-lobby-host -p zc-discord -p zc-inspector-zeep -p zc-import-zsl --bins
New-Item -ItemType Directory -Force dist | Out-Null
Copy-Item "$env:CARGO_TARGET_DIR/release/zeepcentraal-*.exe" dist/
```

CI stages Linux Rust binaries in `dist/` before Docker builds. Build images from that output:

```bash
docker build -f Dockerfile.server -t zc-server .
docker build -f Dockerfile.jobs -t zc-jobs .
docker build -f Dockerfile.migrate -t zc-migrate .
docker build -f Dockerfile.zsl -t zc-import-zsl .
```

Run Docker images with environment values:

```bash
docker run --env-file .env -p 3000:3000 zc-server
docker run --env-file .env zc-jobs
docker run --env-file .env zc-migrate
```

Run ZSL import container:

```bash
git clone --branch data https://github.com/zeepkist/super-league.git super_league_data
docker build -f Dockerfile.zsl -t zc-import-zsl .
docker run --env-file .env zc-import-zsl
```
