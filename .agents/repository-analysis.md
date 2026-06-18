# ZeepCentraal Repository Analysis

Repository state reviewed on June 18, 2026.

This file is durable repository memory for future agents. For day-to-day operating rules, read
the root [`AGENTS.md`](../AGENTS.md).

## System overview

ZeepCentraal is a private TypeScript monorepo managed as a Bun workspace. It produces four
self-contained Bun executables:

- `zeepcentraal-server`: the Elysia HTTP API.
- `zeepcentraal-jobs`: the Graphile Worker task runner and cron scheduler.
- `zeepcentraal-migrate`: the Drizzle migration runner.
- `zeepcentraal-import-zsl`: the Zeepkist Super League data importer.

All executables are packaged separately in shell-less `gcr.io/distroless/base` images. PostgreSQL
is the shared persistence and job-queue backend.

### Workspace dependency direction

```text
jobs       <- core + database
server     <- core + database + jobs/queue
import-zsl <- database
```

The packages have these responsibilities:

- `packages/core`: validated environment configuration, JWT and cookie handling, shared errors
  and types, cache primitives, and Discord/Steam integrations. It must not depend on application
  packages.
- `packages/database`: the Drizzle schema, PostgreSQL client, migrations, and service functions.
  It exposes the root package and the explicit `@zeepkist/database/services` subpath.
- `packages/jobs`: Graphile Worker task implementations, queue compatibility boundary, scoring
  utilities, cron registration, and worker lifecycle.
- `packages/server`: Elysia route modules and cross-cutting plugins. It consumes database services
  and only the `@zeepkist/jobs/queue` subpath for enqueueing.
- `packages/import-zsl`: a one-shot import process for Super League metadata and results.

Workspace packages export TypeScript source directly for development. Production artifacts are
compiled from their entry points with `bun build --compile`; there is no intermediate JavaScript
package build.

## API architecture

`packages/server/src/server.ts` is the application composition root. `buildServer()` installs
plugins in this order:

1. request logging;
2. CORS;
3. OpenTelemetry;
4. span enrichment;
5. OpenAPI documentation;
6. central error handling;
7. database context;
8. auth, user, record, vote, and job route modules;
9. `/favicon.ico` and `/healthz`.

Routes are grouped by Elysia prefixes under `/auth`, `/user`, `/record`, `/vote`, and `/job`.
Elysia `t` schemas define request bodies. The API preserves a legacy V1 wire contract, including
capitalized request fields in several endpoints, numeric error codes, empty successful response
bodies, redirects, and authentication cookies. `packages/server/src/v1Errors.ts` and
`withErrors.ts` centralize the common error shape, although some routes intentionally construct
specific V1 responses inline.

Authentication has distinct paths:

- GTR/game requests use bearer JWTs and the GTR auth plugin.
- Web and Discord/Steam flows use provider-specific access tokens and refresh cookies.
- `/job/trigger` requires an exact `Bearer ${TRIGGER_JOB_TOKEN}` header and accepts only tasks in
  the jobs package's compatibility allowlist.
- Record submission also applies the mod-version guard before accepting data.

The database instance is attached to Elysia context, but current route modules primarily call
functions from `@zeepkist/database/services`. This service boundary should remain the normal place
for queries and mutations.

`packages/server/src/index.ts` uses Node-compatible cluster APIs. The primary process always forks
two API workers and replaces a worker after an exit. Workers build and listen to their own Elysia
application and stop it on `SIGINT` or `SIGTERM`. Any process-local cache or singleton therefore
exists independently in each worker.

OpenTelemetry is configured through Elysia/OpenTelemetry plugins and exports over OTLP gRPC.
Unhandled errors are recorded on the active span before the V1 error response is returned.

## Database architecture

`packages/database/src/index.ts` creates a module-level `postgres` client and Drizzle database.
The runtime connection pool is configured with:

- `max: 10`;
- `idle_timeout: 30`;
- `DATABASE_URL`, with a local PostgreSQL fallback in this module.

Application startup imports `packages/core/src/config.ts`, whose Zod schema requires
`DATABASE_URL`, `TRIGGER_JOB_TOKEN`, and a `JWT_SECRET` of at least 32 characters. In normal
server/jobs operation, missing required values fail early during module initialization.

`packages/database/src/schema.ts` is the schema source of truth. It currently models levels and
metadata, records and media, personal/world records, users and authentication, votes/favourites,
level/user points and histories, version compatibility, and ZSL seasons/rounds/results. Table and
column names use existing PostgreSQL snake_case names while TypeScript properties use camelCase.
Foreign keys, unique constraints, and indexes are declared beside each table.

Database access is organized into focused modules under `packages/database/src/services`. The
service barrel is exposed through both the package root and `/services`. API routes, jobs, and the
importer should consume these functions instead of duplicating Drizzle queries.

Drizzle Kit configuration lives in `packages/database/drizzle.config.ts`. It reads
`DATABASE_URL`, then tries the repository `.env`, then falls back to the local development URL.
Schema changes follow this sequence:

1. edit `packages/database/src/schema.ts`;
2. run `bun run db:generate`;
3. review and commit the generated SQL, snapshot, and journal changes under
   `packages/database/drizzle`;
4. run `bun run db:migrate` against the intended database.

There are 24 numbered SQL migrations in the reviewed state. Existing applied migrations and their
metadata are historical artifacts and must not be rewritten. The compiled migration runner finds
`MIGRATIONS_FOLDER` when explicitly set, otherwise it checks `./drizzle` and
`./packages/database/drizzle`. The migration container copies migrations to `/app/drizzle`.

## Jobs and scheduling

`packages/jobs/src/tasks/index.ts` is the Graphile Worker task registry. Its string keys must
exactly match identifiers passed to `addJob`/`addJobs`. Task implementations use a local typed
`TaskHandler<TPayload>` alias while the registry adapts them to Graphile Worker's generic
signature.

`packages/jobs/src/queue.ts` is the API-facing enqueue boundary. It lazily creates
`makeWorkerUtils`, restricts external requests to a fixed compatible-task allowlist, and enqueues
with priority `5` and `maxAttempts: 1`. A newly API-triggerable task must be added to both this
allowlist and the task registry.

Tasks commonly fan out work with Graphile Worker's `helpers.addJob` or `helpers.addJobs`.
Large input sets are divided with the shared `batchProcess` utility. Examples include:

- level score scans enqueueing one `updateLevelScore` per level;
- level and user history coordinators enqueueing paginated batch tasks;
- a level score update enqueueing affected player-score work.

`packages/jobs/src/index.ts` also uses a two-worker cluster, but process responsibilities differ:

- The primary process owns all cron timers and uses `makeWorkerUtils` only to enqueue jobs.
- Two child processes each run a full Graphile Worker runner and process tasks.
- Exited child workers are replaced.
- Primary and workers handle signals separately and release/stop their own resources.

This split is important: cron scheduling must remain primary-only or every worker will enqueue
duplicates. The runner disables Graphile Worker's crontab file (`crontabFile: ''`) and signal
handling because scheduling and lifecycle are managed by application code.

Current application-managed cron schedules use the `Europe/London` timezone:

| Task | Schedule | Purpose |
| --- | --- | --- |
| `updateLevelScores` with `{ all: true }` | `0 1 * * 1` | Weekly full recalculation |
| `updateLevelScores` with `{ all: false }` | `*/10 * * * *` | Recent-level refresh |
| `updatePlayerScores` | `5-59/10 * * * *` | Player leaderboard refresh |
| `updateLevelPointsHistory` | `0 * * * *` | Hourly level history |
| `updateUserPointsHistory` | `0 0,12 * * *` | Twice-daily user history |

Default cron jobs use priority `5` and one attempt. A priority option object also exists with
priority `0` and three attempts but is not currently used by the cron registrations.

## ZSL importer

The importer is a one-shot process that reads `metadata.json`, imports seasons, and then imports
each round in order. `SUPER_LEAGUE_DATA_PATH` can override its data directory. Otherwise it checks
the container path and repository-relative development paths.

CI clones the `data` branch of `zeepkist/super-league` into `super_league_data`. The ZSL image
copies that checkout to `/data/super_league_data` and sets the matching environment variable.
Changes to expected data layout must be coordinated with both importer code and the workflows.

## Build, release, and deployment

Root scripts compile binaries into `dist/`:

- `bun run build:server`
- `bun run build:jobs`
- `bun run build:migrate`
- `bun run build:import-zsl`

Each Dockerfile copies only the compiled binary plus required runtime data:

- server and jobs copy only their executable;
- migrate also copies Drizzle migrations;
- import-zsl also copies Super League data.

Because the runtime base is distroless, images have no shell, package manager, Bun installation, or
source tree. Runtime behavior cannot rely on shell scripts, dynamic package installation, or files
that are not explicitly copied.

`.github/actions/setup-bun-deps/action.yml` installs the requested Bun version (default `latest`),
caches workspace `node_modules`, and runs `bun install --frozen-lockfile` on a cache miss.

Pull-request validation performs:

1. typecheck, Bun tests, Biome checks, and a Biome format check;
2. compilation of all four binaries and artifact upload;
3. download and verification of the artifacts;
4. no-push builds of all four Docker images.

Deployment runs on pushes to `develop` and manual dispatch. Tests run before per-package
semantic-release. Release commits are excluded from recursively releasing. Package releases use
conventional commits and package-scoped tags such as `server@1.2.3`, `jobs@1.2.3`,
`database@1.2.3`, and `import-zsl@1.2.3`.

After release, four independent jobs rebuild and push images to GHCR. Each image receives:

- `latest`;
- the Git commit SHA;
- major version;
- major/minor version;
- full package version.

The migrate image derives its version from the `database@*` tag. Build jobs fetch tags and fail if
the expected package tag cannot be found or parsed.

## Configuration and secrets

`.env.example` documents the common local values, but `packages/core/src/config.ts` is the
authoritative runtime schema. Required values are:

- `DATABASE_URL`;
- `TRIGGER_JOB_TOKEN`;
- `JWT_SECRET` with at least 32 characters.

Other configuration covers host/port, JWT audience/issuer/TTLs, frontend/backend URLs, Steam,
Discord, Wasabi/S3, and OpenTelemetry. `.env` and `.env.*` are ignored except for `.env.example`.
Never place real credentials in tracked files, logs, tests, workflow expressions, or documentation.

## Tests and code quality

The repository uses Bun Test. Current tests consist of:

- focused JWT behavior tests in `packages/core/src/auth/jwt.spec.ts`;
- API contract tests in `packages/server/src/contract.spec.ts`.

The contract suite mocks core, database, and job modules, invokes `app.handle(Request)`, and checks
status codes, exact V1 response shapes, headers/cookies, redirects, and enqueue/database side
effects. Endpoint behavior changes should be covered there. Jobs, database services, importer
logic, clustering, and cron registration currently have little or no direct automated coverage.

TypeScript is strict and uses bundler resolution, ESM preservation, explicit `.ts` imports where
needed, `noUncheckedIndexedAccess`, and no emit. Biome formatting uses tabs, width 100, single
quotes, and semicolons only when required. Biome also organizes imports.

Normal validation commands are:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run format
```

Use `lint:fix` and `format:fix` only when edits are intended.

## Maintenance observations

- `bun` is not pinned in `package.json`; CI requests `latest`. Bun/compiler changes can therefore
  affect builds without a repository change. Consider pinning when reproducibility becomes a
  priority.
- API and jobs worker counts are hard-coded to two. Container CPU limits and horizontal scaling do
  not dynamically change process count.
- The jobs primary uses in-memory cron timers. Multiple jobs containers will each schedule the same
  cron entries unless deployment guarantees a single scheduler replica or jobs are deduplicated.
- The PostgreSQL client is a module-level singleton with a maximum of 20 connections per process.
  With two API workers and two job workers, connection capacity must be sized per process and per
  replica.
- API-triggered job payloads are only structurally a record of unknown values at the HTTP
  boundary. Individual handlers own payload assumptions; malformed values may fail asynchronously.
- The queue's lazy `WorkerUtils` singleton has no explicit shutdown path in the server process.
- The API primary and jobs primary always restart exited workers, including repeated crash loops.
- Tests strongly cover API compatibility but not SQL behavior, task calculations, cron ownership,
  migration execution, or importer failure modes.
- The deploy workflow repeats image-version resolution and image publishing logic four times,
  which increases the chance of package-specific drift.

These are observations, not authorization to refactor unrelated code. Address them only when they
are relevant to the requested task.

## Validation status for this analysis

Repository paths, scripts, workflows, Dockerfiles, source entry points, task names, cron schedules,
and package relationships were inspected directly.

Validation was re-run successfully on June 18, 2026, using Bun 1.3.14:

- `bun install --frozen-lockfile`: passed; 657 installs across 852 packages checked with no changes.
- `bun run typecheck`: passed.
- `bun run test`: passed; 28 tests across 2 files, 0 failures.
- `bun run lint`: passed; 123 files checked with no fixes applied.
- `bun run format`: passed; 123 files checked with no fixes applied.
