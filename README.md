<h1 align="center">ZeepCentraal</h1>

<p align="center"><strong>Race. Compete. Explore.</strong></p>

<p align="center">
  Community platform for <a href="https://store.steampowered.com/app/1440670/Zeepkist/">Zeepkist</a>. World records, ghost replays, leaderboards, levels and tournaments.
</p>

<p align="center">
  <a href="https://zeepki.st"><img alt="Website: zeepki.st" src="https://flat.badgen.net/static/website/zeepki.st/blue"></a>
  <a href="https://zeepki.st/records"><img alt="Live records" src="https://flat.badgen.net/static/records/live/green"></a>
  <a href="https://zeepki.st/wiki/setup-modkist"><img alt="Get started with GTR" src="https://flat.badgen.net/static/GTR/mod%20install%20guide/orange"></a>
</p>

<p align="center">
  <a href="https://github.com/zeepkist/zeepcentraal/blob/develop/LICENSE"><img alt="MIT license with exceptions" src="https://flat.badgen.net/static/license/MIT%20with%20exceptions/blue"></a>
  <a href="https://github.com/zeepkist/zeepcentraal/graphs/contributors"><img alt="Contributors" src="https://flat.badgen.net/github/contributors/zeepkist/zeepcentraal"></a>
  <a href="https://github.com/zeepkist/zeepcentraal/stargazers"><img alt="GitHub stars" src="https://flat.badgen.net/github/stars/zeepkist/zeepcentraal"></a>
</p>

<p align="center">
  <a href="https://github.com/zeepkist/zeepcentraal/blob/develop/Cargo.toml"><img alt="Rust services" src="https://flat.badgen.net/static/backend/Rust/blue"></a>
  <a href="https://github.com/zeepkist/zeepcentraal/blob/develop/package.json"><img alt="Bun runtime" src="https://flat.badgen.net/static/runtime/Bun/blue?icon=bun"></a>
  <a href="https://github.com/zeepkist/zeepcentraal/tree/develop/packages/web"><img alt="Nuxt frontend" src="https://flat.badgen.net/static/frontend/Nuxt/green"></a>
  <a href="https://github.com/zeepkist/zeepcentraal/tree/develop/packages/graphql"><img alt="GraphQL API" src="https://flat.badgen.net/static/API/GraphQL/purple"></a>
</p>

**ZeepCentraal** brings the competitive Zeepkist community together in one place. Discover levels, follow records as they happen, compare player times and ghost replays, and compete in community events.

With **ZeepCentraal GTR**, supported game sessions can submit personal bests and ghost replays to online leaderboards. ZeepCentraal also powers community tournaments, player rankings, Adventure leaderboards and tools for finding what to race next.

> **Want to submit records?** See the **[Modkist setup guide](https://zeepki.st/wiki/setup-modkist)**.

## Contents

- [What you can do](#what-you-can-do)
- [Explore ZeepCentraal](#explore-zeepcentraal)
- [Technology](#technology)
- [Repository layout](#repository-layout)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

## What you can do

- **Online records and ghost replays:** Submit personal bests with GTR, explore world records and compare runs against other players.
- **Player rankings and medals:** Follow competitive rankings, compare player statistics, and chase Author, Expert, Apex and other medals.
- **Level discovery:** Browse community-made Workshop levels, find new challenges and build playlists.
- **Community competitions:** Take part in the **Zeepkist Super League** and Track of the Day, Week and Month events, with individual and overall standings.
- **Adventure leaderboards:** Compare completion progress and combined times across Adventure Mode and its individual series.
- **Online lobbies:** Browse public rooms and explore recorded lobby history and statistics.
- **Community tools:** Integrations and services for the wider Zeepkist community, including Discord and streaming tools.

## Explore ZeepCentraal

| Feature | Link |
| --- | --- |
| Home | [zeepki.st](https://zeepki.st) |
| Live records | [Records feed](https://zeepki.st/records) |
| Player rankings | [Global standings](https://zeepki.st/users) |
| Community levels | [Level browser](https://zeepki.st/levels) |
| Adventure Mode | [Adventure leaderboards](https://zeepki.st/adventure) |
| Track of the Week | [Overall standings](https://zeepki.st/totw/overall) |
| Track of the Month | [Overall standings](https://zeepki.st/totm/overall) |
| Online rooms | [Lobby browser](https://zeepki.st/lobby) |
| Medal rules | [Medals wiki](https://zeepki.st/wiki/zeepcentraal-gtr/medals) |
| GTR setup | [Modkist setup guide](https://zeepki.st/wiki/setup-modkist) |

## Technology

ZeepCentraal is a **Rust and TypeScript monorepo**. Its main components include:

| Layer | Technologies |
| --- | --- |
| Web application | [Nuxt](https://nuxt.com/), [Vue](https://vuejs.org/), TypeScript |
| Backend services | Rust, [Bun](https://bun.sh/), TypeScript |
| API | [GraphQL](https://graphql.org/), PostGraphile |
| Database | [PostgreSQL](https://www.postgresql.org/), Diesel |
| Tooling | Bun, Cargo, Biome |
| Deployment | Docker |

The public service is operated at **[zeepki.st](https://zeepki.st)**; this repository contains its application and service source code.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`crates/`](crates/) | Rust services, database code and shared libraries |
| [`packages/web/`](packages/web/) | Nuxt web application |
| [`packages/graphql/`](packages/graphql/) | Shared GraphQL types and queries |
| [`packages/`](packages/) | TypeScript packages and supporting services |
| [`scripts/`](scripts/) | Development, build and release tooling |

## Development

### Prerequisites

- **Bun:** use the version specified in [`package.json`](package.json).
- **Rust toolchain:** see [`Cargo.toml`](Cargo.toml) for Rust workspace requirements.
- **Service configuration:** see [`.env.example`](.env.example). Some features require external services and credentials.

### Install dependencies

```bash
bun install --frozen-lockfile
```

### Run locally

Start the web application:

```bash
bun run dev:web
```

Run backend services as needed:

```bash
bun run dev:server
bun run dev:postgraphile
```

These commands start individual components; running a full local stack also requires correctly configured supporting services. See repository configuration for the environment your changes need.

### Checks

```bash
bun run typecheck
bun run test
bun run lint
bun run format
```

For Rust changes, check formatting and run tests for affected crates:

```bash
cargo fmt --all -- --check
cargo test --locked -p <crate-name>
```

> **Note:** `bun run test` runs the Rust workspace tests. For Bun tests, use `bun run test:bun`.

## Contributing

Bug reports, fixes and improvements are welcome. Before opening a pull request:

1. Check existing [issues](https://github.com/zeepkist/zeepcentraal/issues) and [pull requests](https://github.com/zeepkist/zeepcentraal/pulls).
2. Include tests for behaviour changes and run relevant checks.
3. Explain what changed and how you tested it.
4. Use commit prefixes such as `fix:` and `feat:`.

Do not include credentials, private data or production configuration in issues, logs or commits.

## License

Most of ZeepCentraal is licensed under the **[MIT License](LICENSE)**.

**Exceptions:** Level geometry, geometry extraction and the `lobby-host` crate are **not** covered by the MIT licence. Permission to reproduce or modify those components is granted **only for ZeepCentraal**; no permission is granted for other projects. Review applicable restrictions before reusing source code.

ZeepCentraal is a community project for Zeepkist.
