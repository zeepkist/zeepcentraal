# Standalone evaluation validation — 2026-09-19

Current work replaces Postrust with Axum/Serde/Scalar and exclusive SQLx/Diesel builds.
Both adapters passed unit tests, native migration repeatability, invalid-input checks,
foreign-key failure and rollback on the second transaction statement. Both passed
HTTP/Scalar/OpenAPI smoke tests. Scalar rendered in headless Edge with external
network blocked. SQLx and Diesel dependency-tree checks exclude Postrust/GraphQL;
Diesel excludes SQLx. Clippy passed for both server feature selections.

Serenity is pinned to `86866e9a20dc441faac7b38c68a3cf78721ded1c`; native Components V2
payloads match discord.js golden fixtures. Session ownership/capacity/expiry and
subscription protocol reducer tests passed. This is an offline replay evaluation,
not a connected or feature-complete bot. See [remaining Discord gates](discord/README.md).

Existing Bun suite: 1,087 passed, 11 skipped, zero failures. Root typecheck, lint and
format passed (41 existing lint warnings); server/jobs/migrate/importer builds passed.
Pilot runs validate plumbing only and are excluded from performance conclusions.

The controlled REST run completed all nine scheduled attempts: Bun 3/3 valid, SQLx
2/3, Diesel 0/3. Rejected attempts contained dropped arrivals and remain in the
[published results](benchmark/RESULTS-AXUM-2026-09-19.md). Neither Rust candidate
passed the full offered-load gate. No production memory or throughput claim follows.

Both Discord replay candidates passed isolated transient 429/500 and permanent-failure
checks: two successful deliveries advanced two cursors. The Linux replay image includes
CA certificates required by Reqwest's default client initialization. No Discord tokens,
Gateway login, command registration or external messages were used. Remote CI has not
run; checks above are local evidence.

The [Discord replay](discord/RESULTS-2026-09-19.md) completed three trials per candidate,
without errors or dropped arrivals. All six delivery/cursor audits passed; each ended
with zero duplicate sends, pending feeds and retained sessions. Median idle application
PSS was 74.0 MiB for discord.js and 7.1 MiB for Serenity. These are offline replay
results, not connected bot memory or complete command compatibility.

---

## Historical Postrust validation (superseded runtime)

# Local evaluation evidence — 2026-09-17

This records the first executable gate. It does not certify the full Rust migration,
production API compatibility, or the memory target.

Environment: Windows Rust 1.98.1 release binaries; Docker Desktop Linux engine;
isolated PostgreSQL 18.6. Existing Bun checks ran from the canonical Windows checkout
using `bun.exe`. No production database or services were changed.

| Check | Result |
| --- | --- |
| SQLx and Diesel unit suites | 5 passed per variant; database test explicitly ignored in these suites |
| SQLx and Diesel PostgreSQL integration | 1 passed per variant; repeated migrations, lookup, leaderboard, atomic record/audit write, rollback after second-statement failure |
| SQLx and Diesel Clippy | Passed with warnings denied |
| Rust formatting | Passed |
| SQLx and Diesel release builds | Passed |
| Admin, OpenAPI, Swagger, Scalar, generated REST | HTTP smoke passed on both variants |
| GraphQL queries and HTTP mutations | Passed on both variants |
| WebSocket initial result and update after application write | Passed on both variants |
| Browser rendering | Admin, Scalar and GraphQL playground rendered; playground executed a query and displayed results |
| TypeScript/Rust binary fixtures | Matching aligned and unaligned golden bytes |
| Historical Drizzle inventory | 86 migration files validated; SQL replay and ledger adoption not yet tested |
| Existing Bun tests | 1,087 passed, 11 skipped, 0 failed |
| Existing typecheck, lint, format | Passed; pre-existing lint warnings remain |
| Existing server, jobs, migrate, import-zsl builds | Passed |
| Python load-tool test and shell syntax | Passed |

The browser checks found two integration issues that are fixed in this gate:
`/admin/` needed a redirect to the nested router root, and upstream WebSocket handling
omitted the `GraphQLContext` required by subscriptions. The local WebSocket schema
now includes queries/subscriptions only. HTTP owns mutation commit/rollback.

A 1,000-request, concurrency-8 read smoke also completed without errors against each
variant. These single Windows-host samples are not an A/B verdict: compilation activity,
fixture history, pool budgets and host load were not controlled for comparative analysis.
Linux PSS, idle/active distributions, peak memory, production throughput, SteamCMD jobs,
and the Bun baseline remain unmeasured here.

Generated screenshots, logs and local request samples live under ignored
`artifacts/rust-evaluation/`. Use the commands in [README.md](README.md) to reproduce
checks. CI is configured for both variants but has not run remotely.
