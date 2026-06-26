# ZeepCentraal agent guide

Applies repo-wide. Style: caveman. Few words. Keep technical terms, code, exact errors. Prefer `location / problem / fix`.

Read [`.agents/repository-analysis.md`](.agents/repository-analysis.md) only when task needs architecture, deployment, scheduling, or package-boundary context.

## Map

- `packages/core`: config/env, JWT/cookies, shared errors/types, cache, Steam, Discord. No app-package deps.
- `packages/database`: Drizzle schema/client/migrations/services.
- `packages/workshop`: Steam metadata/downloads, level parsing, thumbnails, DB reconciliation.
- `packages/jobs`: Graphile tasks, scoring, queue, cron, worker lifecycle.
- `packages/server`: Elysia API/plugins/routes. Use DB services. Enqueue only through `@zeepkist/jobs/queue`.
- `packages/import-zsl`: one-shot Super League importer.

Dependency direction:

```text
core, database -> workshop -> jobs
core, database, jobs/queue -> server
database -> import-zsl
```

## Commands

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run format
```

Build affected executable. Build all after shared/build/deploy changes:

```bash
bun run build:server
bun run build:jobs
bun run build:migrate
bun run build:import-zsl
```

DB:

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```

Do not run `lint:fix`/`format:fix` for inspection; they rewrite files.

## Code

- ESM, strict TS, `noUncheckedIndexedAccess`.
- Biome: tabs, width 100, single quotes, no unnecessary semicolons, organized imports.
- Use `import type` for type-only imports.
- Public workspace imports need `package.json` exports. Do not import unexported internals.
- Keep service/util functions focused. Do not duplicate DB/scoring logic.
- Preserve unrelated user/generated changes.

## API

- Compose routes through `packages/server/src/server.ts`.
- Use Elysia `t` schemas.
- Preserve V1 wire contract unless requested: field casing, numeric error codes, status codes, empty success bodies, redirects, cookies, headers.
- Queries/mutations go in `@zeepkist/database/services`, not route-local Drizzle.
- Enqueue through `@zeepkist/jobs/queue`.
- Update `packages/server/src/contract.spec.ts` for observable endpoint changes.
- API has two child processes. Process-local state/cache not shared.

## Database

- Source of truth: `packages/database/src/schema.ts`.
- Reusable reads/writes: `packages/database/src/services`, exported through barrel.
- Schema edit flow: edit schema -> `bun run db:generate` -> review/commit SQL snapshot journal.
- Never edit/reorder/delete applied migrations. Add new migration.
- Keep PostgreSQL names/compat constraints stable unless task says otherwise.

## Jobs

- Task key must match `packages/jobs/src/tasks/index.ts`.
- Handler payloads use local `TaskHandler<TPayload>`.
- External/API-triggerable task also needs `packages/jobs/src/queue.ts` allowlist + tests.
- Use `helpers.addJob`/`helpers.addJobs`; use batching utility for large sets.
- Set retry/priority/idempotency deliberately. Retries can repeat partial DB effects.
- Cron only in jobs primary. Workers process tasks only.
- Cron timezone: `Europe/London`.
- Jobs use two worker processes; replicas add concurrency.

## Runtime/release

- Production uses compiled Bun executables in `dist/`; source packages not copied.
- Server/migrate/importer images: `gcr.io/distroless/base`.
- Jobs image: pinned Debian/SteamCMD runtime.
- Runtime assets must be explicitly copied: migrations for migrate, ZSL data for import.
- Keep binary/image/tag names synced across scripts, workflows, Dockerfiles, semantic-release.
- Package release tags drive images. Migrate image uses `database@*`.

## Security

- Never commit `.env`, credentials, tokens, DB URLs, private data, production payloads.
- Secrets: `TRIGGER_JOB_TOKEN`, `JWT_SECRET`, OAuth, Steam, Wasabi/S3, `DATABASE_URL`.
- Do not print secrets in logs/tests/fixtures/errors/docs.
- Use fake values in tests/examples.

## Done means

- Focused tests for behavior/API changes.
- Run typecheck/test/lint/format.
- Build affected executable(s); all four for shared/build/deploy changes.
- Schema changes include generated migration set.
- Deployment changes verify PR + deploy workflow paths and runtime file availability.
- Report skipped checks with reason: environment vs code.
