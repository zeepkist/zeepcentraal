# Streamkist

Twitch stream notifications for Discord game communities. Rust, Serenity, PostgreSQL,
and shared Diesel migrations.

## Run

Required environment: `DATABASE_URL`, `STREAMKIST_DISCORD_TOKEN`, `TWITCH_CLIENT_ID`,
`TWITCH_CLIENT_SECRET`. `STREAMKIST_POLL_SECONDS` defaults to 60 (range 30–300).

```sh
bun run dev:streamkist
bun run build:streamkist
```
