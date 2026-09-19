# Serenity evaluation

[Measured offline replay results](RESULTS-2026-09-19.md): three valid trials per
candidate, zero errors/drops, successful delivery/cursor and recovery audits.

Pinned to `serenity-rs/serenity` commit
`86866e9a20dc441faac7b38c68a3cf78721ded1c` from `next`. No floating branch updates.
This revision includes native Components V2 builders. Upgrades require golden tests
and new measurements. Framework, voice and general Discord caches are disabled.

## Implemented slice

Native containers, sections, thumbnails, file components, separators, buttons and
mention controls are checked against payloads produced by the existing discord.js
`displayContainer`. Serenity emits explicit `disabled:false`; golden builders make
that semantic default explicit. Both evaluation payloads explicitly disable reply mentions
and provide empty user/role allowlists; golden payloads request those same options
from discord.js rather than assuming its omitted-field defaults. Golden file components test serialization, not upload.

Offline HTTP replay exercises profile rendering, autocomplete choices, page/session
storage and feed delivery/cursor ordering. Both candidates use the same normalized
synthetic fixture responses and outbound HTTP calls. They preserve source GraphQL
operation documents, but the fixture is NOT a PostGraphile server: full GraphQL
response decoding and real command semantics are still a later porting gate.

The replay executable uses Reqwest for local transport and Serenity for native payload
builders; it never logs into Discord. The Bun comparator likewise does not log in or
instantiate a Gateway client. Do not present replay memory as connected bot memory.
The compiled Serenity dependency enables Gateway and zlib support for future work;
replay does not exercise them. The subscription reducer tests init/ack, ping/pong,
errors, cancellation and reset; real WebSocket reconnect/resume remains unimplemented.

Session capacity is 256 and default TTL 15 minutes, matching current pagination state.
Replay uses a documented 15-second TTL in both candidates so the 75-second recovery
phase observes expiry plus the normal 60-second cleanup timer. No playlist session
port is claimed. Requests queue behind a single feed drain; both retry local 429/5xx
at most three times. Fault tests ensure permanent DM failures do not advance cursors.
Production bucket/global retry handling must use Serenity's Discord HTTP rate limiter.

## Run

Existing Windows Bun dependencies and Docker Linux engine are required.

```sh
bun.exe --no-env-file tools/rust-evaluation/discord/golden.ts --check
bun.exe --no-env-file tools/rust-evaluation/discord/documents.ts --check
cargo test --locked -p zc-discord-evaluation
bun.exe --no-env-file tools/rust-evaluation/discord/build.ts
python3 tools/rust-evaluation/benchmark/prepare.py
docker.exe build --target build -t zc-rust-benchmark:builder artifacts/rust-evaluation/benchmark/build-context
docker.exe build -f tools/rust-evaluation/discord/Dockerfile -t zc-discord-benchmark:local artifacts/rust-evaluation/benchmark/build-context
python3 tools/rust-evaluation/discord/smoke.py --output artifacts/rust-evaluation/discord/faults-new
python3 tools/rust-evaluation/discord/run.py --quick --rounds 1 --output artifacts/rust-evaluation/discord/pilot-new
python3 tools/rust-evaluation/discord/run.py --rounds 3 --output artifacts/rust-evaluation/discord/measured-new
python3 tools/rust-evaluation/discord/report.py artifacts/rust-evaluation/discord/measured-new
```

Both apps use CPUs 0–1, 512 MiB/no swap; fixture CPU 2; generator/samplers CPU 3.
Trials rotate candidates. Individual scenarios use 15 events/s, mixed burst 150/s,
capacity concurrency 32. These are explicit synthetic rates, not production estimates.
Measure PSS/RSS/working set separately, plus fixture memory, CPU, completion and acknowledgement latency, pending/peak feed count, outbound
requests and delivery/cursor counts. Reject errors, drops, duplicate sends or lost
cursor updates. No real Discord requests, tokens, registration or messages are used.

## Full bot parity inventory: deferred

- Commands: bot-status, compare, feed, gtr, help, level, link/unlink, linked-role,
  modkist, playlist/recommendations, random-level, stats, totm/totw, user, watch,
  wr-ping, zeepcentraal-profile and zsl, including context menus/autocomplete.
- Full pagination navigation/ownership, playlist attachments (64 sessions / 4 MiB),
  Components V2 edits, ephemeral responses and acknowledgement deadlines.
- Linked-role synchronization on guild joins and link/unlink, permissions and missing roles.
- Rank/workshop/PB/vote/event feeds, tournament message updates, watches and permanent
  DM suppression; delivery persistence, restart recovery and concurrent retry behavior.
- Actual PostGraphile HTTP response models, GraphQL WebSocket reconnect/catch-up,
  readiness dependencies, cancellation, graceful shutdown and existing telemetry.
- Connected Gateway memory with representative guild/member cardinalities and bounded
  caches; measure additional HTTP calls caused by disabling cache.
- Separate test-guild acceptance before production cutover; never run old and new
  delivery workers concurrently against the same production cursors.
