# Bun SQL compatibility

Application database access uses `SQL` from `bun` through `drizzle-orm/bun-sql`.
PostGraphile uses its local `PgAdaptor`; its role audit and invalidation poller
also use Bun SQL. Graphile Worker retains its own driver.

Drizzle and Grafast supply text-encoded parameters. Their clients set
`prepare: false`: Bun 1.4.0's prepared protocol otherwise double-encodes JSON
strings and returns typed numeric arrays. Parameters remain bound; this does
not interpolate values into SQL. Prepared-statement caching is disabled.
Raw Drizzle `UNNEST`/`ANY` queries must bind arrays through `arrayParam`, which
uses Drizzle's PostgreSQL array encoder. Plain `sql.param(array)` bypasses column
encoding and Bun coerces it to comma-separated text, causing SQLSTATE `22P02`.
Each encoded array remains one parameter, including large scoring snapshots.

Direct Drizzle timestamp results have **millisecond precision**, accepted for
this migration. PostgreSQL storage keeps microseconds. PostGraphile's timestamp
text projections retain their existing precision.

Database pool remains five connections. PostGraphile reserves one connection
from `POSTGRAPHILE_DATABASE_POOL_MAX` for Bun's dedicated LISTEN connection;
the remaining slots serve queries. With subscriptions enabled, configure at
least two slots (default remains six). The separate single-connection role
audit and invalidation pool retain their existing limits.
