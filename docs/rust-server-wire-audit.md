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
| Browser Discord/Steam auth | 5 | 0 | **Missing** |
| Discord bot service API | 19 | 19 | Present |
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

## Exact missing routes

| Method | Path | Required contract |
| --- | --- | --- |
| GET | `/auth/discord/link/redirect` | Authenticated link state, five-minute state cookie, Discord 302 |
| GET | `/auth/discord/redirect` | Five-minute state cookie, Discord 302 |
| GET | `/auth/discord/callback` | State validation, OAuth exchange, link/login branches, auth cookies, frontend 302 |
| GET | `/auth/steam/redirect` | State cookie, Steam OpenID 302 |
| GET | `/auth/steam/callback` | State/signature validation, user upsert, auth persistence/cookies, frontend 302 |
| POST | `/v1/rooms/assignment` | Dedicated listener, bearer token, bounded room input, 200/400/401/404/503 JSON, no-store |

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

Current Rust unit/static checks prove handlers compile and named paths exist. They do not prove
unchanged web or GTR compatibility. Cutover remains blocked until missing routes exist and all
rows pass differential tests.
