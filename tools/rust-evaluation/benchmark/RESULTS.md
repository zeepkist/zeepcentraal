# Linux benchmark results — 2026-09-17

Rust used about 81% less warmed-idle application memory and 83% less active application memory than the two-worker Bun baseline for the implemented database/API slice. Throughput remained PostgreSQL-bound. These results do not establish savings or feature parity for the complete production services.

## Same-load memory and measured capacity

Idle is median process PSS over the final 10 seconds of a 35-second warmed-idle window. Active is process PSS p95 at the **same offered 150 requests/second**. Main figures are medians across three independent trials. Capacity is successful throughput at concurrency 32, with its observed trial range. All figures use MiB, not decimal MB.

| Implementation | Trials | Idle PSS MiB | Active PSS p95 at 150 req/s | Capacity req/s | Trial range req/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bun / primary + 2 workers | 3 | 78.0 | 84.4 | 375 | 321–377 |
| Rust / SQLx | 3 | 14.5 | 13.8 | 359 | 331–360 |
| Rust / Diesel | 3 | 15.2 | 14.5 | 398 | 375–400 |
| Bun / single process (diagnostic) | 1 | 52.1 | 56.9 | 375 | 375–375 |

The single-process Bun result is one diagnostic trial, not a repeated comparison. It shows that process topology explains part of the savings: removing workers reduced its active footprint by about one third, while Rust still used about 75% less active PSS than that single-process baseline. This is not authorization to change production worker counts.

PSS apportions shared pages rather than counting each shared page fully for every worker. All Bun primary/worker processes are included. Rust PSS can be slightly lower during load because shared runtime-library pages are then apportioned with the separate load-generator process; that does not mean the application freed memory. RSS and cgroup measurements are retained separately below and in the raw reports.

## Latency and retained memory

| Implementation | p95 at 15 req/s, ms | p95 at 150 req/s, ms | p95 at capacity, ms | PSS p95 at capacity, MiB | PSS after 35 s recovery, MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| Bun / primary + 2 workers | 22.8 | 34.1 | 196.0 | 91.9 | 80.9 |
| Rust / SQLx | 22.0 | 32.6 | 126.8 | 14.1 | 15.0 |
| Rust / Diesel | 20.6 | 28.6 | 138.4 | 14.8 | 15.8 |
| Bun / single process (diagnostic) | 22.4 | 34.9 | 191.8 | 60.4 | 54.1 |

Every main trial sustained both offered loads without request errors or dropped arrivals. The nine main trials completed 128,689 workload requests across warmup/measured phases, plus 1,152 client-priming requests. Successful writes matched committed audit rows. No app OOM, swapping, or memory-limit hits occurred. This short benchmark is not a leak or soak test.

## Where throughput stopped scaling

PostgreSQL consumed approximately one full allocated core at saturation; applications used about 0.07–0.10 cores and the generator about 0.07–0.08 cores. Thus the table measures a database-bound workload, not the maximum HTTP throughput of Bun or Rust.

Diesel had the highest observed median here. Bun and Diesel trial ranges overlap; SQLx varied from 331 to 360 requests/second. Three short trials do not justify a universal ORM ranking or certify a 5% performance-equivalence bound. Results include each implementation’s SQL, driver, prepared-statement behavior and pool settings. No production adapter is selected by this result.

## Separate memory accounting at saturation

| Implementation | App summed RSS p95, MiB | App cgroup working set p95, MiB | PostgreSQL PSS median, MiB | PostgreSQL cgroup working set median, MiB |
| --- | ---: | ---: | ---: | ---: |
| Bun / primary + 2 workers | 150.2 | 58.9 | 167.9 | 341.6 |
| Rust / SQLx | 15.1 | 6.5 | 177.3 | 354.1 |
| Rust / Diesel | 15.8 | 6.5 | 176.7 | 351.9 |
| Bun / single process (diagnostic) | 61.4 | 27.6 | 167.9 | 331.3 |

Summed RSS double-counts shared pages. Cgroup working set is usage minus inactive file cache and depends on page-cache charging; it is not interchangeable with PSS. PostgreSQL remains a substantial, separate cost. An 83% application-memory reduction is not an 83% reduction in total host memory.

## Test conditions and limits

- Linux x86-64 Docker VM: four CPUs, 7.76 GiB RAM; WSL2 kernel 5.15.167.4. Apps pinned to CPUs 0–1 with a 512 MiB limit and swap disabled. Database pinned to CPU 2 with a 1 GiB limit; generator/samplers on CPU 3.
- Rust 1.98.1 release builds with thin LTO; Bun 1.4.0 compiled with `--smol`, Elysia 2 AOT, production mode, and the checkout’s Drizzle/Bun SQL dependencies. PostgreSQL 18.6; 128 MiB shared buffers, 4 MiB work_mem, JIT disabled.
- Synthetic 136 MB fixture: 20,000 users, 2,000 levels, 1,000,000 records. Mix: 70% lookups, 20% grouped top-100 leaderboards, 10% atomic record/audit writes. Hot levels contain 40% of records and receive 80% of level requests. Each trial restores the same template and prewarms relations. Variant order rotates across rounds.
- Four application DB connections each. SQLx additionally reserves a shared-pool slot for Postrust’s listener; Diesel uses a separate Postrust pool. Bun/SQLx idle timeout is 30 seconds; Diesel/bb8 retains its 600-second default with a 30-second reaper. Pool lifetimes were not normalized.
- Postrust admin/GraphQL were enabled for both Rust binaries, but the request workload used application REST routes. No active GraphQL subscriptions or GraphQL query workload was benchmarked.
- 15 req/s approximates the supplied 1.3 million/day average. The tenfold 150 req/s burst, dataset cardinalities, and endpoint mix are explicit assumptions, not captured production traffic.
- No production authentication/session workload, complete record/PB/queue transaction, jobs, scoring, SteamCMD, workshop parsing, lobby protocol, PostGraphile, Checkmate/MongoDB, SigNoz, or production telemetry was included. The Bun baseline is an equivalent slice, not the current complete production executable.
- Memory sampled every 500 ms. Peaks shorter than that can be missed. The Docker kernel exposes cgroup v1 but not PSI; pressure data is marked unavailable. No seven-day or bare-metal production baseline was collected.

## Reproduce and inspect

- [Method and commands](README.md)
- [Full main summary and per-trial data](../../../artifacts/rust-evaluation/benchmark/linux-2026-09-17/report.json)
- [Main raw run directory](../../../artifacts/rust-evaluation/benchmark/linux-2026-09-17/)
- [Single-process diagnostic](../../../artifacts/rust-evaluation/benchmark/linux-bun-single-2026-09-17/report.json)

Raw artifacts are ignored by Git and remain in this workspace. They include sample time series, phase request counts/latencies, container state, image IDs and binary/source hashes. Failed harness-validation attempts and an intentionally interrupted setup trial were excluded; published main results are the three completed rounds in `linux-2026-09-17`.

Validation: Linux Rust release builds and Linux Bun AOT build passed; benchmark TypeScript check and three report-unit tests passed; repository typecheck, lint and format passed (41 existing lint warnings); Bun suite passed 1,087 tests with 11 skipped and zero failures. The disposable benchmark database and measurement containers were removed after collection. Interactive preview containers were left running.
