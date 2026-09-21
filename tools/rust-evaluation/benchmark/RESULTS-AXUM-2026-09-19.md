# Axum / SQLx / Diesel evaluation — 2026-09-19

This run replaces the Postrust experiment with standalone Axum/Serde release binaries,
embedded Scalar documentation, and independent SQLx or Diesel pools. Existing
PostGraphile/Ruru remains outside the Rust migration. Earlier Postrust measurements
are preserved in [RESULTS.md](RESULTS.md); do not combine the two datasets.

The workload is an equivalent synthetic API slice, not the production API: 70% user
lookups, 20% top-100 leaderboards and 10% atomic record/audit writes, against 20,000
users, 2,000 levels and one million records. See [methodology](README.md) for skew,
CPU/pool limits and phase durations. No production trace was available. The assumed
15 req/s average and 150 req/s burst do not establish real production peak capacity.

Docker Desktop used a four-core WSL2 Linux VM with about 8 GiB RAM. Applications had
two pinned CPUs, a 512 MiB limit and no swap; PostgreSQL had one pinned CPU, a 1 GiB
limit and 128 MiB shared buffers. Other existing local services were left running.
Database swap was already about 4 MiB across attempts; no application swap or
memory-limit event was observed in inspected failed phases. Neither this nor
uncontrolled host activity establishes the cause of latency spikes.

Every scheduled attempt is retained. Failed offered-load attempts are excluded from
aggregate medians and are not retried. The controller was resumed once after the
first rejected Diesel attempt to continue the remaining schedule, verifying identical
images, binaries and settings. Reporting was extended to expose rejected attempts;
no candidate code or runtime setting changed during measurement.

The run does not establish an ORM winner or satisfy production migration acceptance.
Investigate the latency/drop failures before selecting either adapter. Application
PSS reductions in this slice cannot be extrapolated to all services or total server
RAM: PostgreSQL, Checkmate/MongoDB, SigNoz, retained PostGraphile, SteamCMD and complete
service behavior remain outside the application comparison.

Raw phase JSON and 500 ms memory samples remain under ignored
`artifacts/rust-evaluation/benchmark/axum-measured-2026-09-19/`. The companion portable
JSON preserves environment/image/binary identifiers, phase summaries and failures.

[Portable results](results-axum-2026-09-19.json).

## Recorded results

PSS counts shared pages proportionally. Values below are medians across trials; idle uses the final 10 seconds of the warm-idle window. Active uses per-trial p95 at the same 150 req/s offered load. This is not a production-service benchmark.

| Variant | Valid/attempted | Idle PSS MiB | Active p95 PSS MiB | Recovery PSS MiB | Capacity req/s (min–max) | Capacity p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bun-2 | 3/3 | 75.3 | 82.4 | 81.4 | 322 (317–381) | 230.4 |
| sqlx | 2/3 | 6.7 | 6.1 | 7.5 | 321 (259–383) | 150.4 |
| diesel | 0/3 | — | — | — | — | — |

## Rejected attempts

Rejected attempts are excluded from medians, not retried or hidden. A candidate with rejected attempts has not passed the full offered-load acceptance gate.

- 1-diesel: burst: 0 HTTP errors, 13 dropped arrivals
- 2-diesel: burst: 0 HTTP errors, 168 dropped arrivals
- 2-sqlx: burst: 0 HTTP errors, 185 dropped arrivals
- 3-diesel: typical: 0 HTTP errors, 34 dropped arrivals

Failed-phase observations below are diagnostic only: they are not accepted throughput or comparable steady-load memory results.

| Attempt | Phase | Completed req/s | Dropped | App p95 PSS MiB | DB median PSS MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| 1-diesel | burst | 149.2 | 13 | 6.2 | 159.1 |
| 2-diesel | burst | 141.5 | 168 | 6.4 | 159.1 |
| 2-sqlx | burst | 140.6 | 185 | 6.9 | 160.9 |
| 3-diesel | typical | 13.0 | 34 | 6.1 | 158.2 |

## Fixed offered load

| Variant | 15 req/s p95 ms | 150 req/s p95 ms | 15 req/s PSS p95 MiB | 150 req/s PSS p95 MiB | Errors / dropped |
| --- | ---: | ---: | ---: | ---: | ---: |
| bun-2 | 20.6 | 34.7 | 79.1 | 82.4 | 0 / 0 |
| sqlx | 18.5 | 32.4 | 5.8 | 6.1 | 0 / 0 |

## PostgreSQL and container accounting at saturation

| Variant | DB PSS median MiB | DB working set median MiB | App working set p95 MiB | App RSS p95 MiB | DB CPU cores | Generator CPU cores |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bun-2 | 162.8 | 331.0 | 58.2 | 149.2 | 1.00 | 0.07 |
| sqlx | 162.4 | 335.3 | 3.3 | 7.5 | 1.00 | 0.07 |
