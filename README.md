# ZeepCentraal

Zeepkist community tools written in Rust and TypeScript.

## Repository

- [`crates/`](crates/): Rust services and shared libraries.
- [`packages/web/`](packages/web/): Nuxt website.
- [`packages/graphql/`](packages/graphql/): Shared GraphQL types and queries.
- [`packages/`](packages/): TypeScript packages and shared code.
- [`scripts/`](scripts/): Development and release tools.

## Contributing

Include tests for behavior changes. Describe changes and test results in your pull request.
Use commit prefixes such as `fix:` or `feat:`.

Use Bun's version from [`package.json`](package.json). Rust requirements are in
[`Cargo.toml`](Cargo.toml).

Install workspace dependencies:

```sh
bun install --frozen-lockfile
```

Run repository checks:

```sh
bun run typecheck
bun run test
bun run lint
bun run format
```

For Rust changes, check formatting and run tests for affected crates:

```sh
cargo fmt --all -- --check
cargo test --locked -p <crate-name>
```

Keep credentials, private data, and production configuration out of commits and issue reports.

## License

[MIT](LICENSE)

Level geometry, geometry extraction and the lobby-host crate are not covered by the MIT license. Permission
to reproduce or modify them is granted only for [ZeepCentraal](https://zeepki.st). No permission is
granted for other projects.
