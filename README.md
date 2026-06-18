# ZeepCentraal (V3)

A Bun workspace monorepo for ZeepCentraal services.

## What This Repository Is

- A modular API backend built with Elysia and Bun.
- A PostgreSQL-backed data layer using Drizzle ORM.
- A background processing system using graphile-worker for durable jobs and cron scheduling.

## Workspace Layout

- `packages/core`: shared config, auth, errors, integrations, and utility primitives.
- `packages/database`: Drizzle schema, migrations, and data services.
- `packages/server`: HTTP API process (Elysia routes and plugins).
- `packages/jobs`: background worker process (graphile-worker tasks + cron scheduler).

## Prerequisites

Before you start, install:

- Bun (latest stable): https://bun.sh
- PostgreSQL (running locally or remotely and reachable from `DATABASE_URL`)
- Git
- Docker (optional, only needed for container builds/runs)

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

## Git Hooks

`bun install` configures a Husky pre-commit hook. Before each commit it applies Biome fixes to
staged files, then runs the full typecheck and test suite. Use `HUSKY=0` only when an emergency
bypass is required.

## Build and Docker

Build local binaries:

```bash
bun run build:server
bun run build:jobs
```

Build Docker images:

```bash
docker build -f Dockerfile.server -t zeepcentraal-server .
docker build -f Dockerfile.jobs -t zeepcentraal-jobs .
docker build -f Dockerfile.migrate -t zeepcentraal-migrate .
docker build -f Dockerfile.zsl -t zeepcentraal-import-zsl .
```

Run Docker images with environment values:

```bash
docker run --env-file .env -p 3000:3000 zeepcentraal-server
docker run --env-file .env zeepcentraal-jobs
docker run --env-file .env zeepcentraal-migrate
```

Run ZSL import container:

```bash
git clone --branch data https://github.com/zeepkist/super-league.git super_league_data
docker build -f Dockerfile.zsl -t zeepcentraal-import-zsl .
docker run --env-file .env zeepcentraal-import-zsl
```
