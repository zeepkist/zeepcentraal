# Streamkist

Rust service port of `X:\GitHub\zeepkist\streamkist`, using workspace Serenity,
PostgreSQL, Diesel migrations, telemetry, and environment loading.
Original checkout remains intact. Secrets and logs are not copied.

Run shared `zeepcentraal-migrate` before starting this service. Migration
`20261010130000_streamkist` creates separate `streamkist` schema. No startup DDL.
Streamkist starts with fresh PostgreSQL tables. Configure watches through Discord
after starting bot.

Required environment: `DATABASE_URL`, `STREAMKIST_DISCORD_TOKEN`, `TWITCH_CLIENT_ID`,
`TWITCH_CLIENT_SECRET`. Use separate Discord application from ZeepCentraal bot:
registration replaces that application's global commands. Optional
`STREAMKIST_DEVELOPMENT_GUILD_ID` limits registration to development server.
`STREAMKIST_POLL_SECONDS` defaults to 60; range 30–300 seconds.

```sh
cargo run --locked -p zc-streamkist
cargo build --locked --release -p zc-streamkist --bins
```

Root shortcuts: `bun run dev:streamkist` and `bun run build:streamkist`.

Commands preserve original names:

- `/ping`: ephemeral `Pong!`.
- `/add-stream-channel category:<game> channel:<channel>`: Twitch game name
  autocomplete stores game ID. Manually entered exact game name or ID also works.
  Discord native channel picker completes text and announcement channels.
- `/show-stream-channels`: ephemeral channel list, selection, and removal button.
  Controls expire after 30 seconds and require command author plus Manage Server
  permission. Admin commands check Manage Server or Administrator at runtime.

New guilds support one active watch. Transaction locks guild row so concurrent
commands cannot exceed quota. `guilds.watch_limit` supports 1, 3, or 5 for future
paid plans; no paid-plan purchase or user-accessible quota override exists.
Bot needs View Channel, Send Messages, and Embed Links in chosen channel.

Polling sends one Components V2 message per watch and Twitch stream ID. Cards
show title, streamer, game, 1280×720 preview, relative start time, current viewers,
observed peak viewers, and Watch stream button. Existing live streams are posted
on first poll. Updates persist only after successful Discord delivery. Unchanged
snapshots skip edits; preview refreshes every five minutes. Observed peaks are
sampled, not exact Twitch analytics peaks.

Tracked broadcasters remain tracked after switching game. Only successful direct
broadcaster lookup can finish card. Finished cards show fixed observed duration,
zero current viewers, preserved peak, and Visit channel button. Finished rows
are excluded from later polls. Removing watch stops its notifications and edits.
Twitch failures and rate limits retry next interval, without marking streams offline.

PostgreSQL lease permits one polling replica at a time. Cycle has 120-second
deadline and 180-second lease. Stable enforced Discord nonce reduces duplicate
sends when delivery succeeds but DB save fails. Discord nonce deduplication is
time-limited; arbitrary outages cannot guarantee exactly-once delivery.

Release target `zc-streamkist`, binary `zeepcentraal-streamkist`, image
`Dockerfile.streamkist`. Both PR and deploy workflows build and stage service.
