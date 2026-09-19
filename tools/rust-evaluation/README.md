# Rust migration evaluation

Standalone Axum + Serde + Diesel REST benchmark with Scalar documentation. Recorded
SQLx/Diesel A-B results remain historical evidence; migration implementation selected
Diesel. GraphQL server migration is out of scope.

## Current implementation

- `/docs` serves embedded Scalar assets; `/openapi.json` describes explicit application
  routes through Utoipa, including Serde casing, null results and empty 204 responses.
- `/evaluation/user/{steam_id}`, `/evaluation/leaderboard/{level}` and
  `POST /evaluation/record` implement the same synthetic slice as the Bun comparator.
- No Postrust, generated REST, admin CRUD or GraphQL server dependencies. Diesel does
  not include SQLx; each adapter owns one application pool (four connections by default).
- Synthetic schema is isolated from production migration state. Production adoption
  verifies frozen Drizzle ledger and PostgreSQL catalog before adding Diesel baseline metadata.

## Preview

Start isolated PostgreSQL fixture, then run Diesel benchmark server:

```powershell
docker compose --env-file NUL -f tools/rust-evaluation/compose.yml up -d --wait
powershell -NoProfile -File tools/rust-evaluation/run.ps1
```

On Linux use `bash tools/rust-evaluation/run.sh` after starting the
same Compose file with `--env-file /dev/null`. No JavaScript dependency installation
is required. Never install Bun dependencies from WSL.

| Surface | Diesel |
| --- | --- |
| Scalar | http://127.0.0.1:4310/docs |
| OpenAPI | http://127.0.0.1:4310/openapi.json |

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

Production workspace contains Diesel only. SQLx remains in recorded benchmark reports only.
