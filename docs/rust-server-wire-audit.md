# Rust server wire-contract audit

Audit source: `packages/server/src/server.ts`, every mounted TypeScript route module,
`packages/server/src/modules/lobby/roomBroker.ts`, and `crates/server/src/app.rs`. Route presence
is static-verified. Behavioral parity remains gated by differential requests against Bun and Rust
with identical fixtures.

## Inventory

| Contract group | Bun routes | Rust routes | Status |
| --- | ---: | ---: | --- |
| Health and favicon | 3 | 3 | Present |
| GTR and web refresh auth | 3 | 3 | Present |
| Browser Discord/Steam auth | 5 | 5 | Present |
| Discord bot service API | 19 | 21 | Present; two Rust-only worker read routes |
| Favourite | 2 | 2 | Present |
| User | 4 | 4 | Present |
| Level | 1 | 1 | Present |
| Record | 1 | 1 | Present |
| Turnstile | 1 | 1 | Present |
| Vote | 1 | 1 | Present |
| Job | 1 | 1 | Present |
| Lobby snapshot/SSE | 2 | 2 | Present; collector feed missing |
| Room broker (separate listener) | 1 | 0 | **Missing** |

Rust-only documentation routes `/openapi`, `/openapi/json`, and `/openapi/scalar.js` do not
replace Bun application routes and do not affect existing clients.

Rust-only authenticated worker routes `/discord-bot/activity-events` and
`/discord-bot/tournaments/current` replace PostGraphile reads inside Discord process. They do not
change public web or GTR contracts.

## Exact missing route

| Method | Path | Required contract |
| --- | --- | --- |
| POST | `/v1/rooms/assignment` | Dedicated listener, bearer token, bounded room input, 200/400/401/404/503 JSON, no-store |

Browser authentication now preserves Discord account-link and login branches, OAuth state
cookies, Steam OpenID signature verification, browser auth persistence, three session cookies,
numeric error codes, and frontend redirects. Focused Rust tests cover state-cookie encoding and
OpenAPI presence; production provider callbacks remain a cutover smoke gate.

`GET /lobby` now returns exact unavailable snapshot casing with `Cache-Control: no-store`.
`GET /lobby/events` uses named `snapshot` events, immediate watch state, change notifications,
and a 15-second heartbeat. Both remain operationally unavailable until Rust lobby collector feeds
snapshots into `LobbySnapshotStore`.

## Present-route verification gates

Every present route still requires Bun-versus-Rust differential coverage for:

- request validation and accepted legacy fields;
- auth provider restrictions and service-token separation;
- status, empty body behavior, numeric error code, and RFC 9457 body;
- JSON casing, integer/string encoding, and nullable fields;
- cookies, redirects, CORS, cache headers, rate-limit headers, and body limits;
- durable side effects, queue payload/key, S3 key, transaction boundary, and retry behavior.

Static route audit is complete: every Bun application path except separate room-broker listener
has a Rust handler. Current Rust unit/static checks prove handlers compile and named paths exist.
They do not prove unchanged web or GTR compatibility. Cutover remains blocked until room broker,
collector feed, and differential behavior tests pass.
