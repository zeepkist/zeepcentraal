# Job queues

Jobs use pgmq 1.12.0 on PostgreSQL 18 through `@zeepkist/core/sql` (Bun native SQL).
`zc_jobs` contains application-owned coalescing and lease state; pgmq contains durable
queue messages and exhausted archives. These schemas are intentionally outside the
Drizzle public model and GraphQL API. Migration 0083 owns their SQL objects.

## Execution

The primary elects one cron scheduler using a dedicated session advisory lock. Existing
Bun.cron schedules retain their London/UTC time zones and do not catch up missed ticks.
Each replica starts a fast worker (4 handlers) and a bulk worker (14 handlers). Fast work
is record-driven level scoring and its player fan-out. All other producers default to
bulk. Children inherit their parent's lane; external HTTP clients cannot select a lane.

Each lane claims oldest eligible messages. Completion can be out of order. Bulk conflict
groups serialize global scoring, sharded level writes, and pruning without occupying
fast handlers. Postgres transaction locks protect actual score writes across both lanes.
A long transaction affecting the same user/level can still briefly delay fast scoring.

Enqueue coalesces by `(lane, jobKey)`, retaining FIFO position and scheduled retry time.
During execution, a new request creates one pending follow-up whose payload is replaced
by later requests. A failed attempt with a pending follow-up yields to that newer request.
Failed final attempts archive independently; fresh follow-ups retain their own budget.
No key means no coalescing. Numeric priority and Graphile job-key modes no longer exist.

Delivery is at least once. Visibility is 120 seconds, renewed every 30 seconds. Stale
claim generations cannot renew/acknowledge. Lease loss terminates the worker; other leases
recover after expiry. Retries start at 5 seconds and double up to 300 seconds, using
per-task attempt limits. Successful messages are deleted. Invalid/exhausted jobs archive
payloads for explicit replay; error metadata is a fixed code, never an exception string.

Claim SQL deliberately joins the pinned pgmq 1.12 table layout to filter busy conflict
groups before selecting messages. This avoids starvation behind large grouped backlogs.
Do not write directly to pgmq queues or upgrade the extension without migration/tests.

Queue operation pools retain `JOBS_QUEUE_POOL_MAX` (default 2). With two API producers,
primary and two workers, queue pools total at most 10 connections per application instance,
plus one dedicated scheduler connection. Each worker retains its separate application
DB pool (5). Add other services/replicas when calculating server connection capacity.

Telemetry includes queue depth, oldest age, archive count and publish/process timings.
The `messaging.operations` counter tracks outcomes. Logs include lane, job ID and attempt;
CLI inspection omits payloads. Archive retention is manual; no automatic deletion.

## Administration

Compiled executable supports:

```sh
zeepcentraal-jobs queue status
zeepcentraal-jobs queue archive fast
zeepcentraal-jobs queue replay fast 123
zeepcentraal-jobs queue transfer --offline
zeepcentraal-jobs queue rollback --offline
```

`transfer` and `rollback` require stopped producers/workers; `--offline` asserts that
operator condition, it does not stop containers. Transfers are transactional and record
source IDs. Legacy pending jobs become bulk jobs with preserved remaining attempts and
retry times. Source-specific keys preserve every outstanding legacy job. Exhausted legacy
rows remain in Graphile for investigation. Graphile schema/functions remain for rollback.

Replay validates an archived payload and atomically enqueues/removes its archive entry.
Invalid archives require offline payload repair; CLI never silently accepts invalid tasks.

Runtime database roles must own the migration objects (current deployment) or receive
explicit USAGE/DML/sequence/function privileges on `zc_jobs` and required pgmq objects.
No runtime installation or public schema grants occur. Startup requires extension 1.12.0.

## Local validation

Use a disposable localhost database named `pgmq_test`. Integration script clears its job
schema and queues. It never accepts another database name or remote hostname.

```sh
bun --no-env-file packages/jobs/test/pgmq.integration.ts postgres://postgres:test@127.0.0.1:55439/pgmq_test
```

Use Windows-native `bun.exe` in WSL against the Windows checkout.
