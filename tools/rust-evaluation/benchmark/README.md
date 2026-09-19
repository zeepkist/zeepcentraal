# Controlled Linux database-slice benchmark

[Axum results, 2026-09-19](RESULTS-AXUM-2026-09-19.md): Bun completed 3/3 attempts,
SQLx 2/3 and Diesel 0/3. Failed offered-load attempts prevent an ORM selection.
[Historical Postrust results, 2026-09-17](RESULTS.md) remain separate; do not pool the datasets.

This compares equivalent user lookup, leaderboard aggregation, and record/audit
transaction endpoints. It does **not** compare complete production services: Rust has
not implemented their full behavior. No production trace or cardinality export was
available for selecting this workload. Treat the workload as explicit assumptions,
not a claim that it reproduces the production request mix.

## Workload and measurement

- PostgreSQL 18.6; 20,000 users, 2,000 levels, 1,000,000 records. Twenty hot levels
  contain 40% of records and receive 80% of level requests.
- Mix: 70% indexed user lookups, 20% grouped top-100 leaderboards, 10% two-statement
  record/audit transactions. IDs vary deterministically. No response cache.
- Bun 1.4.0 uses the checkout's Elysia 2 AOT and Drizzle/Bun SQL dependencies, compiled
  to Linux with `--smol`. `bun-2` runs one primary plus two workers; `bun-1` is available
  as a single-process diagnostic. This is a purpose-built equivalent slice, not the
  existing server binary with all of its modules.
- SQLx and Diesel use standalone Axum/Serde release binaries with embedded Scalar docs enabled.
  No Postrust, GraphQL server, schema discovery or notification listener.
- Four application DB connections each (two per Bun worker), no minimum idle connections,
  30-second idle timeout, five-second acquisition timeout. Diesel reaper interval is one
  second; actual cleanup and connection counts are recorded separately.
- Fixture notification triggers remain identical across all implementations.
- Apps receive CPUs 0–1 and a 512 MiB memory limit with swapping disabled. PostgreSQL
  receives CPU 2 and a 1 GiB limit, 128 MiB shared buffers, 4 MiB work_mem, JIT disabled.
  Load generator/samplers receive CPU 3. The four-core Docker Linux VM is not the
  bare-metal production host; other host activity remains a source of noise.
- Before each trial, recreate the dedicated database from an identical template and
  prewarm tables/indexes. Run variants serially; rotate order across three rounds.
- Each trial: 15 s cold idle, 10 s warmup, 90 s warm idle, 20 s at 15 req/s, 20 s at
  150 req/s, 20 s closed-loop capacity at concurrency 32, 90 s recovery. Idle/recovery
  summaries use their final 10 seconds. This is a short benchmark, not a leak/soak test.
- 15 req/s approximates the stated 1.3 million/day average; 150 req/s is an assumed
  tenfold burst, not an observed production peak. Constant-arrival load includes
  scheduling delay in latency and reports dropped requests instead of hiding them.
- Sample every 500 ms from separate sidecars. Include PID 1 and every descendant,
  excluding samplers. Record process PSS/RSS/private memory, cgroup usage, file cache,
  working set, CPU, swap, memory-limit events, host available memory and memory pressure
  when supported. This Docker kernel does not expose PSI; that field is null.
  Working set means cgroup usage minus inactive file cache. PSS and working set are
  separate measures; never add them. Summed RSS double-counts shared process pages.
- Prime the load generator with 32 requests before each timed phase so its own
  HTTP/runtime initialization does not create an artificial arrival backlog. These
  requests are excluded from throughput and included in the write-audit check.
- Each scheduled attempt runs once. Failed attempts are saved as `failed.json`, reported
  separately and excluded from medians. A rejected offered-load trial fails that
  candidate's acceptance gate; do not keep retrying until a clean result appears.
  `--resume` skips recorded attempts and verifies unchanged images/binaries/settings.
- Validate lookup payloads, leaderboard result shape, success status, and total committed
  audits against successful writes. Reject failed/dropped-load trials. Record generator
  CPU so client saturation can be distinguished from server/database saturation.
- Report medians across independent trials, individual RPS range, per-trial memory p95,
  and PostgreSQL separately. A sampled memory peak can miss spikes shorter than 500 ms.

## Run

Prerequisites: Docker Linux engine exposing CPUs 0–3, Windows Bun and existing Windows
workspace dependencies. These scripts never install npm/Bun dependencies under WSL.
All database operations target the labelled, disposable `zc-benchmark-db` container.
Interactive previews on ports 4310/4311 and their database are separate.

From the repository root in WSL:

```sh
python3 tools/rust-evaluation/benchmark/prepare.py
docker.exe build -t zc-rust-benchmark:axum artifacts/rust-evaluation/benchmark/build-context
/mnt/c/Users/wopia/.bun/bin/bun.exe --no-env-file tools/rust-evaluation/benchmark/build-bun.ts
/mnt/c/Users/wopia/.bun/bin/bun.exe build --compile --target=bun-linux-x64 --minify tools/rust-evaluation/benchmark/load.ts --outfile artifacts/rust-evaluation/benchmark/load
python3 tools/rust-evaluation/benchmark/run.py --quick --rounds 1 --output artifacts/rust-evaluation/benchmark/pilot-new
python3 tools/rust-evaluation/benchmark/run.py --rounds 3 --output artifacts/rust-evaluation/benchmark/measured-new
python3 tools/rust-evaluation/benchmark/report.py artifacts/rust-evaluation/benchmark/measured-new
```

Use a new output directory per run; old evidence is not overwritten. `--variants bun-1`
selects the diagnostic; default variants are `bun-2 sqlx diesel`. `--quick` validates
plumbing with three-second phases and must not be used for published measurements.
Allow roughly 45 minutes for three normal rounds, plus compilation and validation.
No other compilation/load tests should run during measured trials.

The runner cleans up labelled app/sampler containers after each trial. It retains the
benchmark database/template to permit reruns. To remove that disposable fixture:

```sh
docker.exe rm -f zc-benchmark-db
```

The build script resolves existing package dependencies and selects Elysia's ESM
exports consistently with its AOT plugin. `tsconfig.json` supplies runtime aliases;
`tsconfig.check.json` resolves corresponding declarations for static checking.

```sh
python3 -m unittest discover -s tools/rust-evaluation/benchmark -p 'test_*.py'
/mnt/c/Users/wopia/.bun/bin/bun.exe x --no-install tsc -p tools/rust-evaluation/benchmark/tsconfig.check.json
```

## Production acceptance still needs

Actual request mix and cardinalities; equivalent authentication/authorization, PB/queue
transactions, jobs/workshop/SteamCMD, lobby traffic, and GraphQL workloads; the same
observability configuration; production-like concurrency and database plans; repeated
bare-metal measurements alongside PostgreSQL, Checkmate/MongoDB and SigNoz. A result
from this harness alone cannot certify 50% savings for the complete migrated services.
