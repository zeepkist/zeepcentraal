# ZeepCentraal API (V3)

This repository is the fresh V3 implementation of the Zeepkist API.

## Goals

- Preserve V1-compatible endpoint contracts for existing clients/mods.
- Rebuild on modular Bun workspace packages.
- Use Elysia, Drizzle, PostgreSQL, OpenTelemetry, JWT, TTL cache.
- Replace graphile-worker with pg-boss for durable jobs + cron.

## Workspace

- `packages/core`: shared config, auth, errors, caching primitives.
- `packages/database`: Drizzle schema and data services.
- `packages/server`: Elysia API and route modules.
- `packages/jobs`: pg-boss worker and scheduled tasks.
