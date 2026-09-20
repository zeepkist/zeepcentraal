# Rust server wire-contract audit

Audit source: `packages/server/src/server.ts`, every mounted TypeScript route module,
`packages/server/src/modules/lobby/roomBroker.ts`, and `crates/server/src/app.rs`. Route presence
is static-verified. `packages/server/scripts/differential-contract.ts` sends identical unchanged
web/GTR-shaped requests to Bun and Rust; production fixture execution remains a cutover gate.

## Inventory

| Contract group | Bun routes | Rust routes | Status |
| --- | ---: | ---: | --- |
| Health and favicon | 3 | 3 | Present |
| GTR and web refresh auth | 3 | 3 | Present |
| Browser Discord/Steam auth | 5 | 5 | Present |
| Discord bot service API | 19 | 30 | Present; 11 Rust-only worker/command read routes |
| Favourite | 2 | 2 | Present |
| User | 4 | 4 | Present |
| Level | 1 | 1 | Present |
| Record | 1 | 1 | Present |
| Turnstile | 1 | 1 | Present |
| Vote | 1 | 1 | Present |
| Job | 1 | 1 | Present |
| Lobby snapshot/SSE | 2 | 2 | Present; Rust collector feeds memory and Diesel persistence |
| Room broker (separate listener) | 1 | 1 | Present |

Rust-only documentation routes `/openapi`, `/openapi/json`, and `/openapi/scalar.js` do not
replace Bun application routes and do not affect existing clients.

Rust-only authenticated routes for activity events, tournament snapshots, profiles, level lookup,
level autocomplete, random levels, statistics, and playlists replace PostGraphile reads inside
Discord process. They do not change public web or GTR contracts. Read-only integration coverage
executes those Diesel queries against current development PostgreSQL schema.

Browser authentication now preserves Discord account-link and login branches, OAuth state
cookies, Steam OpenID signature verification, browser auth persistence, three session cookies,
numeric error codes, and frontend redirects. Focused Rust tests cover state-cookie encoding and
OpenAPI presence; production provider callbacks remain a cutover smoke gate.

`GET /lobby` now returns exact unavailable snapshot casing with `Cache-Control: no-store`.
`GET /lobby/events` uses named `snapshot` events, immediate watch state, change notifications,
and a 15-second heartbeat. Rust collector authenticates through Steam, parses master list/update/
statistics packets, updates `LobbySnapshotStore`, and serially persists equivalent lobby history.
Dedicated broker listener preserves bearer auth, bounded input, no-store responses, stored-room
join fallback, room creation, and master connection handoff. Live master and lobby-host smoke
remains.

## Differential runner

Run Bun and Rust against same schema and isolated test credentials, then:

```bash
BUN_SERVER_URL=http://127.0.0.1:3000 \
RUST_SERVER_URL=http://127.0.0.1:3100 \
bun run test:server:differential
```

Built-in cases cover health, favicon, lobby snapshot/SSE shape, GTR login/refresh/level/record
requests, web refresh, favourite/vote/user/Discord mutations, Turnstile validation, and job
authentication. `SERVER_DIFFERENTIAL_FIXTURES` accepts extra JSON cases for authenticated success
paths; header values may reference `${VARIABLE}` without logging resolved secrets. Comparison checks
status, contract headers, canonical JSON/body values, and full lobby snapshot field/type shape.

## Present-route verification gates

Every present route still requires Bun-versus-Rust differential coverage for:

- request validation and accepted legacy fields;
- auth provider restrictions and service-token separation;
- status, empty body behavior, numeric error code, and RFC 9457 body;
- JSON casing, integer/string encoding, and nullable fields;
- cookies, redirects, CORS, cache headers, rate-limit headers, and body limits;
- durable side effects, queue payload/key, S3 key, transaction boundary, and retry behavior.

Static route audit is complete: every Bun application path and separate room-broker listener has a
Rust handler. Current Rust unit/static checks prove handlers compile and named paths exist. They do
not prove unchanged web or GTR compatibility. Cutover remains blocked until paired differential
fixtures and live lobby collector/broker behavior pass.
