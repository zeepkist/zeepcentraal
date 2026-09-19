# Rust migration evaluation

Standalone Axum + Serde REST candidates with Scalar documentation and independently
buildable SQLx/Diesel adapters. Production Bun services remain unchanged. GraphQL
server migration is explicitly out of scope: retain PostGraphile and Ruru, including
subscriptions. Rust clients may continue to consume that GraphQL API.

## Current implementation

- `/docs` serves embedded Scalar assets; `/openapi.json` describes explicit application
  routes through Utoipa, including Serde casing, null results and empty 204 responses.
- `/evaluation/user/{steam_id}`, `/evaluation/leaderboard/{level}` and
  `POST /evaluation/record` implement the same synthetic slice as the Bun comparator.
- No Postrust, generated REST, admin CRUD or GraphQL server dependencies. Diesel does
  not include SQLx; each adapter owns one application pool (four connections by default).
- Native SQLx and Diesel migration runners apply identical synthetic SQL to separate
  disposable databases. Production Drizzle migration history is read-only.
- Preview is loopback-only and rejects foreign Host/Origin headers. Production JWT,
  sessions, complete record transactions, jobs, workshop and lobby behavior are not ported.

## Preview

Start the isolated PostgreSQL fixture, then run each adapter in a separate terminal:

```powershell
docker compose --env-file NUL -f tools/rust-evaluation/compose.yml up -d --wait
powershell -NoProfile -File tools/rust-evaluation/run.ps1 -Adapter sqlx
# Separate terminal:
powershell -NoProfile -File tools/rust-evaluation/run.ps1 -Adapter diesel
```

On Linux use `bash tools/rust-evaluation/run.sh sqlx` or `diesel` after starting the
same Compose file with `--env-file /dev/null`. No JavaScript dependency installation
is required. Never install Bun dependencies from WSL.

| Surface | SQLx | Diesel |
| --- | --- | --- |
| Scalar | http://127.0.0.1:4310/docs | http://127.0.0.1:4311/docs |
| OpenAPI | http://127.0.0.1:4310/openapi.json | http://127.0.0.1:4311/openapi.json |

Smoke: `bun.exe --no-env-file tools/rust-evaluation/smoke.ts http://127.0.0.1:4310`.

## Evaluation gates

1. [Controlled REST benchmark](benchmark/README.md): fresh Bun/Axum-SQLx/Axum-Diesel
   measurements. [Recorded results](benchmark/RESULTS-AXUM-2026-09-19.md) include rejected
   attempts; neither Rust candidate passed every trial. [Previous Postrust results](benchmark/RESULTS.md) are historical only.
2. [Serenity Discord evaluation](discord/README.md): pinned `next` revision, native
   Components V2, golden payloads, bounded sessions, offline application replay.
3. Full service parity: port API/auth and job/queue contracts, workshop/SteamCMD,
   lobby protocols and complete Discord commands/feeds before production replacement.
4. Production-shaped acceptance: measure combined idle/active memory, DB load, latency,
   backlog and telemetry on equivalent hardware. Target at least 50% lower migrated
   application memory without exceeding the agreed 5% performance regression bound.
   These are acceptance gates, not results of a small synthetic benchmark.

SQLx remains a SQL toolkit rather than a traditional ORM. Both choices retain typed
query/result handling and a native migration layer; neither is selected as winner yet.
