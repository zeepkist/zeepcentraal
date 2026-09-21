# Rust migration contract

Rust workspace replaces Bun processes in place. Existing PostgreSQL database remains
authoritative. No shadow production database, data copy, or historical migration replay.

## Fixed architecture

- Axum + Serde + Utoipa + embedded Scalar for HTTP API.
- Diesel and diesel-async for PostgreSQL access and migrations. SQLx remains historical
  benchmark evidence only.
- Serenity `next` revision pinned by Git commit for Discord Components V2.
- OpenTelemetry OTLP traces, metrics, and logs from every long-running Rust service.
- Existing `pgmq` 1.12.0 queues, task names, payloads, retry limits, lanes, and job keys.
- Existing Wasabi S3 objects and keys. No object migration.
- GraphQL excluded. PostGraphile/Ruru remain separate until callers no longer need them.

## Environment loading

Every Rust executable initializes the shared `zc-core` environment source before telemetry or
service configuration. In development it searches the current directory and its parents for
`.env`. Set `ZC_ENV_FILE` to require a specific file instead. OS environment variables always
override file values. Server and jobs log whether `DATABASE_URL` came from process environment or
local file, plus host and port. They never log URL, credentials, or database name. Clear stale
PowerShell `$env:DATABASE_URL` values when intending to use `.env`.

When global `NODE_ENV=production`, automatic `.env` discovery is disabled. Production therefore
uses process variables from its container or service manager. An explicit `ZC_ENV_FILE` still
loads when deliberately configured. Library crates never read configuration files themselves and
the loader never copies file values into the process environment.

## Database adoption

Each Rust process owns one physical Diesel pool and keeps one connection warm. Server reserves
five application and two queue connections. Jobs reserves eight application, two queue, and one
scheduler connection; logical partition semaphores prevent request work from consuming queue or
scheduler capacity. `DATABASE_POOL_MAX` controls the application partition and
`JOBS_QUEUE_POOL_MAX` controls the queue partition. Existing timeout variables configure both pool
acquisition and PostgreSQL session timeouts. `/healthz` remains process liveness; `/readyz` checks
database readiness and returns HTTP 503 problem JSON while PostgreSQL is unavailable.

Server pool is lazy. Server binds while PostgreSQL is offline, keeps health, Scalar/OpenAPI, lobby
feed, and Turnstile routes available, and returns existing HTTP 503 problem JSON from database,
authentication, mutation, and Discord routes. Database supervisor retries from 250ms to 5s with
30-second warning throttling. Readiness returns to 200 after PostgreSQL and pgmq recover without a
process restart. Missing pgmq 1.12.0 or incompatible `zc_jobs` schema remains fatal.

Jobs retains its scheduler connection and warms both queue lanes before reporting readiness. New
physical connections are established serially to avoid cold-start connection bursts. Temporary
database outages keep jobs alive with a 250ms-to-5s capped retry; queue polling and scheduler
leadership resume after PostgreSQL recovers. Startup waits for database availability until shutdown,
while missing pgmq objects or incompatible queue schema remain fatal.

## Record score projection

Accepted PBs enqueue a coalesced fast `updateLevelScore` job, then a fast
`updateLevelContributions` repair keyed by level, user, and submitted record. Both use the same
per-level lock group. The repair reads current PB and level points, then enqueues a record-keyed
fast `updatePlayerScore`. Contention defers repair on the fast lane without failing its attempt.
The durable bulk 50-user cursor still updates other users. Record HTTP response remains empty 200;
level points and contribution/player points are asynchronous projections.

When projection stays stale, inspect queue state read-only before assuming latency. These queries
show recent score work and archived failures without exposing full payloads:

```sql
SELECT lane, id, task, job_key, lock_group, running, attempts, max_attempts,
       lease_until, payload->>'idLevel' AS id_level,
       payload->>'idUser' AS id_user, payload->>'projectionToken' AS token
FROM zc_jobs.job
WHERE task IN ('updateLevelScore', 'updateLevelContributions', 'updatePlayerScore')
ORDER BY id DESC LIMIT 100;

SELECT msg_id, archived_at, message->>'task' AS task,
       message->>'failure' AS failure,
       message->'payload'->>'idLevel' AS id_level,
       message->'payload'->>'idUser' AS id_user
FROM pgmq.a_zeepcentraal_fast
WHERE message->>'task' IN ('updateLevelScore', 'updateLevelContributions', 'updatePlayerScore')
ORDER BY msg_id DESC LIMIT 100;
```

`zeepcentraal-migrate verify` is read-only. It acquires a PostgreSQL advisory lock, checks
frozen 87-row Drizzle ledger (legacy prefix plus 86 journal entries), and compares 53 tables, one view,
and 535 columns from `0086_snapshot.json` with `pg_catalog`.
Five historical SQL files have a committed SHA-256 hash different from the first frozen ledger
(`0001`, `0002`, `0054`, `0055`, `0064`). Verification accepts either exact approved hash for those
entries, with journal order and timestamps unchanged. Unknown hashes still stop adoption and report
the ledger row, migration tag, and observed hash. Neither variant replays historical SQL or changes
the Drizzle ledger.

`zeepcentraal-migrate adopt` performs the same checks, then transactionally creates Diesel's
metadata table and records the no-DDL baseline `20260919000000`. It refuses partial Drizzle
history, catalog drift, or pre-existing Diesel versions without that baseline. Future schema
changes are additive Diesel migrations. Applied Drizzle migrations stay immutable.

Cutover sequence:

1. Deploy migration binary and run `verify` against current database.
2. Stop Bun writers and drain jobs/record uploads.
3. Run `adopt`; apply pending additive Diesel migrations.
4. Start Rust services against same `DATABASE_URL` and existing object store.
5. Run wire-contract and smoke checks from unchanged web and GTR clients.
6. Switch traffic. Keep Bun images available for application rollback; never reverse schema
   by deleting data or replaying old migrations.

## OpenTelemetry

Development exports OTLP gRPC traces, metrics, and error logs to
`https://ingress.zeepki.st:443`. Blank service-name variables are ignored, producing
`zeepcentraal-<service>-dev`; production images explicitly set unsuffixed service names. HTTP
server spans use matched routes and W3C Trace Context, and record status and duration without
query values or authorization headers. Set `OTEL_SDK_DISABLED=true` to keep local structured logs
while disabling exporters. Invalid explicit endpoint or `RUST_LOG` values stop startup. Exporter
failures warn locally and do not stop service.

Opt-in smoke checks use configured development database and collector:

```bash
cargo test -p zc-database --test pool_reliability -- --ignored --nocapture
cargo test -p zc-jobs --test pool_reliability -- --ignored --nocapture
cargo test -p zc-telemetry --test live_otlp -- --ignored --nocapture
```

Database checks use `ZC_TEST_DATABASE_URL` when set, then fall back to development `DATABASE_URL`.
`ZC_TEST_DATABASE_HOST` can replace only URL hostname for container-to-host test routing.
Telemetry smoke emits one successful and one failed synthetic request, then forces all providers
to flush; exporter rejection fails test.

## Required compatibility gates

- Every server route preserves path, method, JSON casing, cookies, headers, status codes,
  numeric error codes, redirects, authentication, rate limits, and empty success bodies.
- Record submission preserves ghost limits/parsing, atomic PB/tournament updates, S3 upload,
  workshop claims, and follow-up jobs.
- Jobs implements every registered task and cron schedule before workers may claim queues.
- Discord preserves commands, Components V2 payloads, feed cursors, pagination sessions,
  REST authentication, reconnect behavior, and health reporting.
- Lobby host preserves Lidgren bytes, authenticated control packets, multi-level playlist
  framing, Steam lifecycle, room broker, snapshots, and SSE recovery.
- Workshop preserves Steam metadata, SteamCMD supervision, level parsing/hashing, thumbnails,
  reconciliation, retries, and S3 keys.
- Importer and inspector must reproduce current mutations and idempotency, not only validate
  configuration.
- Production-shaped benchmark reports PSS, RSS, cgroup working set, PostgreSQL memory, file
  cache, RPS, latency, errors, dropped arrivals, DB connections, and queue backlog under the
  same request mix. Target: at least 50% lower migrated application memory and no more than
  5% throughput regression.

## Current implementation status

Implemented Rust paths now include database adoption and generated Diesel schema, telemetry,
Steam authentication and metadata, GTR token rotation, record submission with ghost parsing and
S3 persistence, queue workers and registered handlers, bounded SteamCMD workshop scanning and
reconciliation, level parsing and hashes, ZSL import, Scalar API docs, Zeepkist V18 packet codecs,
and bounded Lidgren reliable ordered transport. Inspector now includes strict config, contest and
submission reconciliation, level validation, validation caching, S3 payload and playlist writes,
Diesel state transitions, reactions, Components V2 multipart publication, crash recovery, and
cleanup ordering.

Release remains blocked. Discord now embeds, registers, and dispatches all 20 active command
definitions, including profile/level lookup, autocomplete, tournaments, playlists, statistics,
comparison, and random levels through authenticated Diesel-backed server reads. It syncs linked
roles and exposes supervised health/readiness state. Durable activity feeds, direct-message
watches, world-record loss pings, and Track of the Week/Month polling use independent persisted
cursors and idempotent delivery records. Level and tournament leaderboards now use owner-bound,
expiring Components V2 first/previous/next/last sessions with fresh Diesel pages. Lobby executable
now wires managed-room supervision,
join-ID persistence, ownership enforcement, bounded transfer queue, roster/chat, leaderboard
projection, tournament assets and polling, ZSL inspector playlists, and Wasabi-backed level
transfers. Rust server now owns Steam-authenticated master collection, lobby snapshot/SSE input,
transactional Diesel lobby history, and separate room assignment broker. Live Zeepkist validation
remains required. Server static route inventory and Bun/Rust differential runner are complete in
`rust-server-wire-audit.md`; paired authenticated fixture execution remains. Read-only Discord
command queries execute against current development PostgreSQL schema. Inspector runtime passes
unit and static checks. Live smoke cannot start until inspector config, Discord token, and SteamCMD
path are supplied. Deployment images, production-shaped benchmark gates, unchanged
web/GTR smoke tests, and cutover rehearsal also remain incomplete.
