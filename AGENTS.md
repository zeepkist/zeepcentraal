# ZeepCentraal Agent Guide

This file applies to the entire repository. Read
[`.agents/repository-analysis.md`](.agents/repository-analysis.md) for detailed architecture,
deployment, scheduling, and maintenance context.

Speak like a caveman. Remove all filler words. Keep technical terms, code blocks, and error messages
exact. Be extremely concise. Use fewest tokens possible. Output only the location, problem, and fix.

## Repository map

- `packages/core`: environment validation, JWT/cookies, shared errors/types, cache, Steam, Discord.
  Keep it independent of other workspace packages.
- `packages/database`: Drizzle schema, PostgreSQL client, migrations, and database services.
- `packages/jobs`: Graphile Worker tasks, scoring utilities, queueing, cron scheduling, lifecycle.
- `packages/server`: Elysia API routes/plugins. Query through database services and enqueue only
  through `@zeepkist/jobs/queue`.
- `packages/import-zsl`: one-shot Super League data importer.
- `.github/workflows` and `Dockerfile.*`: validation, release, binary, and image contracts.

Respect the dependency direction: `core` and `database` are foundations; `jobs` depends on both;
`server` depends on `core`, `database`, and the jobs queue subpath; `import-zsl` depends on
`database`.

## Setup and required checks

Use Bun from the repository root:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run lint
bun run format
```

Build affected executables, or all four when changing shared/build/deployment behavior:

```bash
bun run build:server
bun run build:jobs
bun run build:migrate
bun run build:import-zsl
```

Database commands:

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```

Do not use `lint:fix` or `format:fix` merely to inspect the repository; they rewrite files.

## Code conventions

- Use ESM and strict TypeScript. Preserve `noUncheckedIndexedAccess` assumptions.
- Follow Biome: tabs, four-column tab width, single quotes, no unnecessary semicolons, width 100.
- Let Biome organize imports; use `import type` for type-only imports.
- Keep package exports intentional. Add or change `package.json` exports when introducing a public
  workspace import path; do not reach into another package's unexported internals.
- Prefer focused service and utility functions over duplicating database or scoring logic.
- Preserve unrelated user changes and generated files outside the task.

## API changes

- Compose route modules through `packages/server/src/server.ts` and reuse existing auth, version,
  telemetry, context, logging, CORS, documentation, and error plugins.
- Define Elysia `t` schemas for request inputs.
- Preserve the established V1 contract unless the task explicitly changes it: field casing,
  numeric error codes, status codes, empty bodies, redirects, cookies, and headers are observable.
- Use functions from `@zeepkist/database/services`; do not put new Drizzle queries directly in
  route handlers.
- Enqueue work through `@zeepkist/jobs/queue`, not a route-local Graphile connection.
- Add or update `packages/server/src/contract.spec.ts` for endpoint behavior and exact wire shapes.
- Remember the API runs in two child processes. Process-local state and caches are not shared.

## Database changes

- Treat `packages/database/src/schema.ts` as the schema source of truth.
- Put reusable reads/writes in `packages/database/src/services` and export them through its barrel.
- After a schema edit, run `bun run db:generate` and commit all generated SQL, snapshot, and journal
  changes under `packages/database/drizzle`.
- Review generated SQL before applying it. Run `bun run db:migrate` only against the intended
  database.
- Never edit, reorder, delete, or regenerate an already-applied migration to achieve a new change;
  add a new migration.
- Keep PostgreSQL names and existing compatibility constraints stable unless migration requirements
  explicitly say otherwise.

## Job changes

- Every Graphile task identifier must exactly match its key in
  `packages/jobs/src/tasks/index.ts`.
- Give task handlers a typed payload using the local `TaskHandler<TPayload>` convention.
- If an API or external caller may trigger a task, also add it to the compatibility allowlist in
  `packages/jobs/src/queue.ts` and validate its HTTP-facing behavior.
- Use `helpers.addJob`/`helpers.addJobs` for fan-out and the shared batching utility for large sets.
- Set retry, priority, and idempotency behavior deliberately. A retry can repeat partial database
  effects.
- Cron timers belong only to the jobs primary process. Worker children process tasks; they must not
  register duplicate schedules.
- Cron schedules use `Europe/London`. Account for daylight-saving behavior when changing timing.
- Jobs run in two worker processes, and multiple container replicas may create additional
  concurrency.

## Builds, containers, and releases

- Production outputs are compiled Bun executables in `dist/`; workspace packages are not copied
  into runtime images.
- Runtime images use `gcr.io/distroless/base`. Do not depend on a shell, package manager, source
  files, or undeclared runtime assets.
- Keep binary names synchronized across root scripts, package build scripts, workflow artifacts,
  and Dockerfile `COPY`/`CMD` entries.
- Keep required non-binary assets synchronized too: Drizzle migrations for `migrate` and Super
  League data for `import-zsl`.
- If an image/tag/release name changes, update semantic-release expectations, deployment tag
  resolution, PR image builds, Dockerfiles, and documentation together.
- Package-scoped release tags drive image versions. The migrate image uses the `database@*` tag.

## Security

- Never commit `.env`, credentials, tokens, database URLs, private user data, or production payloads.
- Treat `TRIGGER_JOB_TOKEN`, `JWT_SECRET`, OAuth credentials, Steam keys, Wasabi/S3 credentials,
  and `DATABASE_URL` as secrets.
- Do not print secrets in logs, tests, fixtures, command output, errors, or documentation.
- Use obviously fake values in tests and examples.

## Completion checklist

- Add focused Bun tests for changed behavior, including exact API contracts where applicable.
- Run `bun run typecheck`, `bun run test`, `bun run lint`, and `bun run format`.
- Build every affected executable; build all four after shared dependency or pipeline changes.
- For schema changes, review and commit the complete generated migration set.
- For deployment changes, verify both PR validation and deploy workflow paths plus distroless file
  availability.
- Update `README.md`, this guide, or `.agents/repository-analysis.md` when commands, architecture,
  schedules, configuration, or operational assumptions change.
- Report any check that could not run and distinguish environment failures from code failures.
