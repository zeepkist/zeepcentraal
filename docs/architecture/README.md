# ZeepCentraal behavior diagrams

Module pages embed generated Pele SVGs. Editable Mermaid sources live in `mermaid/*.mmd`.
Pele validates each source and renders SVGs with light and dark CSS variable palettes.

Run `bun run diagrams:render` after editing a diagram. Review generated SVG changes with source changes.

## Modules

- [Core](core.md): Rust and TypeScript shared behavior.
- [Database](database.md): Rust persistence boundary and domain data.
- [Discord](discord.md): bot commands and feeds.
- [Inspector Zeep](inspector-zeep.md): contest validation and publication.
- [Jobs](jobs.md): scheduler and worker runtime.
- [Lobby host](lobby-host.md): game connection and managed-room lifecycle.
- [Migrate](migrate.md): migration and inspection commands.
- [Server](server.md): HTTP API and authentication.
- [Streamkist](streamkist.md): Twitch tracking and Discord controls.
- [Telemetry](telemetry.md): Rust and TypeScript telemetry.
- [Workshop](workshop.md): Steam metadata, downloads, parsing, and persistence.
- [GraphQL](graphql.md): schema operations and generated client.
- [PostGraphile](postgraphile.md): GraphQL HTTP and live queries.
- [Web](web.md): Nuxt data, authentication, and playback flows.
