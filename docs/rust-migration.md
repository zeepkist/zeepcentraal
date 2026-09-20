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

## Database adoption

`zeepcentraal-migrate verify` is read-only. It acquires a PostgreSQL advisory lock, checks
frozen 87-row Drizzle ledger (legacy prefix plus 86 journal entries), and compares 53 tables, one view,
and 535 columns from `0086_snapshot.json` with `pg_catalog`.

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

Release remains blocked. Discord now embeds and registers all 20 active command definitions,
dispatches account/feed/watch preference mutations, syncs linked roles, and exposes supervised
health/readiness state. Informational command handlers, activity feed/watch delivery, tournament
polling, and pagination still need parity. Lobby host now has reusable managed-room supervision,
join-ID persistence, ownership enforcement, bounded transfer queue, roster/chat, and leaderboard
projection. Tournament/ZSL asset providers and profile sessions are not wired into its executable.
Server route inventory is complete in `rust-server-wire-audit.md`; lobby snapshot/SSE wire handlers
exist, but collector input, five browser OAuth routes, room broker, and differential behavior tests
remain. Inspector
runtime passes unit and static checks, but its disposable-PostgreSQL integration test and live
Steam/Wasabi/Discord smoke run have not run. Deployment images, production-shaped benchmark gates,
unchanged web/GTR smoke tests, and cutover rehearsal also remain incomplete.
