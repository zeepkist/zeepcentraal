# ZeepCentraal critical context

Durable repo facts only. Root [`AGENTS.md`](../AGENTS.md) has daily rules.

## System

Private Bun/TypeScript monorepo. Four compiled executables:

- `zeepcentraal-server`: Elysia API.
- `zeepcentraal-jobs`: Graphile Worker + cron + SteamCMD workshop scans.
- `zeepcentraal-migrate`: Drizzle migrations.
- `zeepcentraal-import-zsl`: Super League importer.

PostgreSQL = app DB + Graphile queue.

Package deps:

```text
workshop   <- core + database
jobs       <- core + database + workshop
server     <- core + database + jobs/queue
import-zsl <- database
```

Production images copy compiled binary only, plus explicit assets. Distroless images have no shell/source/Bun. Jobs image includes SteamCMD runtime.

## Server

- Composition root: `packages/server/src/server.ts`.
- Route groups: `/auth`, `/user`, `/record`, `/vote`, `/job`.
- Preserve legacy V1 contract: casing, numeric error codes, empty success bodies, redirects, cookies, headers.
- Use Elysia `t` schemas.
- Use `@zeepkist/database/services`; no route-local Drizzle.
- Enqueue only through `@zeepkist/jobs/queue`.
- Contract tests: `packages/server/src/contract.spec.ts`.
- `packages/server/src/index.ts` forks two API workers. Caches/state are per worker.
- GTR auth = bearer JWT. Web OAuth = provider tokens + refresh cookies.
- `/job/trigger` requires `Bearer ${TRIGGER_JOB_TOKEN}` and queue allowlist.
- Record submit uses mod-version guard.

## Database

- Schema source: `packages/database/src/schema.ts`.
- Services: `packages/database/src/services`; exported package root and `/services`.
- Drizzle config: `packages/database/drizzle.config.ts`.
- Migration flow: edit schema -> `bun run db:generate` -> review SQL/snapshot/journal -> commit.
- Never rewrite applied migrations.
- Migration runner uses `MIGRATIONS_FOLDER`, else `./drizzle` or `./packages/database/drizzle`; container copies to `/app/drizzle`.
- Table names stay PostgreSQL snake_case; TS properties camelCase.

## Workshop

- Package: `packages/workshop`.
- Metadata via Steam Web API; content via SteamCMD.
- Scanner parses all `.zeeplevel` files in downloaded item.
- Upserts `level`, `level_item`, `level_metadata`.
- Thumbnail key format: `thumbnails/${generateUid()}.${ext}`.
- After successful scan, `markMissingWorkshopLevelsDeleted(workshopId, activeFileUids)` marks DB `level_item` rows for same `workshop_id` deleted when `file_uid` no longer downloaded.
- Permanent unavailable metadata marks all item rows deleted.
- Transient download failures retry; do not mark deleted.
- Workshop jobs lowest priority.

## Level hashes

- `level.hash` = legacy SHA1/zeepHash compatibility alias, untrusted, non-unique.
- `level.xx_hash` = trusted XXH128 identity, unique where not null.
- JSON `level.zeepHash` is untrusted; identical zeepHash can map to different blox content.
- Backward compatibility: existing legacy row with null `xx_hash` must get populated; do not create new row and orphan records.
- Split level rows only when non-deleted workshop items for same legacy hash resolve to different `xx_hash` values.
- Record submit requires canonical `Hash` for accepted clients; legacy `Level` remains fallback/metadata.

## Jobs

- Task registry: `packages/jobs/src/tasks/index.ts`; keys must match Graphile task identifiers.
- API queue boundary: `packages/jobs/src/queue.ts`; compatible allowlist + Zod payload schemas.
- Use `helpers.addJob`/`helpers.addJobs`; batch large fan-out.
- Primary process owns cron. Worker children run Graphile tasks. No cron in workers.
- Jobs primary and worker count are hard-coded to two.
- Cron timezone: `Europe/London`.

Schedules:

| Task | Cron | Purpose |
| --- | --- | --- |
| `syncWorkshopCatalog` | `0 1 * * 0` | Sunday workshop sync/backfill |
| `updateLevelScores { all: true }` | `0 1 * * 1` | Weekly full score recalculation |
| `updateLevelScores { all: false }` | `*/10 * * * *` | Recent-level score refresh |
| `updatePlayerScores` | `5-59/10 * * * *` | Player score refresh |
| `updateLevelPointsHistory` | `0 * * * *` | Hourly level history |
| `updateUserPointsHistory` | `0 0,12 * * *` | Twice-daily user history |

Graphile stable keys dedupe overlapping cron enqueues across replicas, but each replica still has timers.

## ZSL importer

- Reads Super League `metadata.json` then rounds in order.
- `SUPER_LEAGUE_DATA_PATH` overrides data dir.
- CI clones `zeepkist/super-league` `data` branch into `super_league_data`.
- Import image copies data to `/data/super_league_data`.

## Build/deploy

Root build scripts output `dist/` binaries:

- `build:server`
- `build:jobs`
- `build:migrate`
- `build:import-zsl`

Dockerfiles:

- server: binary only.
- jobs: binary + SteamCMD runtime.
- migrate: binary + Drizzle migrations.
- import-zsl: binary + Super League data.

PR validation: typecheck, tests, lint, format, all builds, artifact verification, no-push Docker builds.

Deploy: pushes to `develop` + manual dispatch. Per-package semantic-release. Tags: `server@x.y.z`, `jobs@x.y.z`, `database@x.y.z`, `import-zsl@x.y.z`. Migrate image version from `database@*`.

## Config/secrets

Runtime schema: `packages/core/src/config.ts`.

Required:

- `DATABASE_URL`
- `TRIGGER_JOB_TOKEN`
- `JWT_SECRET` length >= 32

Other config: host/port, JWT audience/issuer/TTLs, frontend/backend URLs, Steam, Discord, Wasabi/S3, OTEL, CORS, trusted proxy, rate limits.

Never track/log secrets or production payloads. `.env` ignored except `.env.example`.

## Tests/quality

- Bun Test.
- API contract tests mock core/database/jobs and assert exact V1 shapes + side effects.
- TypeScript strict, bundler resolution, ESM, `noUncheckedIndexedAccess`, no emit.
- Biome: tabs, width 100, single quotes, import organization.

Normal validation:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run format
```

Use `lint:fix`/`format:fix` only when rewriting intended.

## Operational notes

- Bun version not pinned; CI uses requested/latest Bun. Compiler/runtime changes can affect builds.
- PostgreSQL client pool max 5 per process. Two API workers + two job workers per replica = capacity planning needed.
- API rate limits are process-local and replica-local.
- Tests cover API compatibility well; SQL/task/cron/importer paths need focused tests when changed.
- Do not refactor observations unless task requires it.
