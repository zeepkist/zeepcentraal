# ZeepCentraal Discord bot

Compiled Bun Discord application.

## Runtime boundary

```text
Discord gateway/interactions
          |
packages/discord
     | GraphQL POST + WS                 | dedicated bearer token
     v                                   v
graphql.zeepki.st                 packages/server /discord-bot/*
     | public reads + live events               | private writes
     +-------------------- PostgreSQL -----------+
```

GraphQL reads are public. Account linking, guild settings, cursors, and preferences use
authenticated server endpoints. Discord ID ownership is proven by Discord OAuth or an 8-digit
one-time code.

## Environment

`DISCORD_CLIENT_ID` identifies application. `DISCORD_CLIENT_SECRET` is used for OAuth callbacks.
Gateway login also requires bot token from same Discord application.

```dotenv
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_REDIRECT_URI=https://backend.zeepki.st/auth/discord/callback
DISCORD_BOT_TOKEN=
DISCORD_BOT_API_TOKEN=shared-random-secret-at-least-32-characters
DISCORD_GRAPHQL_HTTP_URL=https://graphql.zeepki.st
DISCORD_GRAPHQL_WS_URL=wss://graphql.zeepki.st
DISCORD_BACKEND_URL=https://backend.zeepki.st
DISCORD_FRONTEND_URL=https://zeepki.st
DISCORD_REGISTER_COMMANDS=true
```

`DISCORD_BOT_API_TOKEN` must match server deployment. Set `DISCORD_DEVELOPMENT_GUILD_ID` for fast
guild-scoped command registration. Set `DISCORD_REGISTER_COMMANDS=false` on extra replicas so only
one replica updates commands.

## Discord application

Install with `bot` and `applications.commands` scopes. Required permissions: View Channels, Send
Messages, Embed Links, Attach Files, and Read Message History. Linked-role automation additionally
needs Manage Roles and bot role above configured role. Enable privileged Server Members intent for
linked-role assignment on member joins.

OAuth redirect allowlist must contain `/auth/discord/callback`; purpose-bound state distinguishes
login from verified linking.

## Development and build

```bash
bun run dev:discord
bun run build:discord
./dist/zeepcentraal-discord --self-test
```

Production image uses `Dockerfile.discord`. Health probes: `/health` and `/ready` on port 6000.

## Commands

- Account: `/link`, `/unlink`, `/wr-ping`, `/linked-role`.
- Feeds: `/feed` for workshop, WR, rank, TOTW, and TOTM channels.
- Discovery: `/level`, `/user`, `/random-level`, user profile context command.
- Competition: `/totw`, `/totm`, `/zsl`, `/compare`.
- Playlists: `/playlist`, `/playlist-recommend` with downloadable `.zeeplist` attachments.
- Telemetry: `/stats`, `/stats-surface`.
- Notifications: `/watch` for player, level, author, and tournament DMs.
- Setup: `/modkist`, `/gtr`; operations: `/help`, `/bot-status`.
