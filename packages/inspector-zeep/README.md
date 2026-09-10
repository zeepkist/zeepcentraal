# Inspector Zeep

One-shot Discord forum submission scanner. PostgreSQL stores history and validation cache; private Wasabi objects hold immutable prepared level payloads and playlist exports. No persistent Discord gateway connection.

## Run

Copy `inspector.example.json` to private configuration and replace every placeholder ID. Season mapping values are existing `zsl_season.id` values. Titles must match `S8R1 Mixed Surfaces`. Optional contest `roundId` overrides automatic matching; unmatched rounds remain nullable. Never create speculative ZSL rounds.

Required environment: `INSPECTOR_CONFIG_FILE`, `INSPECTOR_DISCORD_TOKEN`, `STEAM_API_KEY`, `STEAM_APP_ID`, `STEAMCMD_PATH`, existing database/Wasabi variables. OpenTelemetry uses existing environment conventions. Do not place secrets in JSON.

```sh
bun run inspect:submissions --dry-run
bun run inspect:submissions
bun run inspect:submissions --force
bun run build:inspector-zeep
```

`--dry-run` fetches source history and previews matching/rule changes without downloads, uploads, database writes, or Discord writes. A transient advisory lock still prevents overlap. `--force` bypasses completed validation cache, not contest freeze or publication deduplication.

Bot needs View Channel, Read Message History, Add Reactions, Send Messages in Threads, and Attach Files. Configure Message Content access as required by Discord for this application. Scanner uses REST, not Gateway intents at runtime. It neither deletes unrelated messages nor removes other users' reactions.

## Rules and history

One selected Workshop item per Discord author. Newer distinct submissions supersede older ones permanently; deleting the selected message does not resurrect superseded entries. Multiple distinct links in a message and multiple level files in an item are invalid. Attachments without Workshop links are not ingested.

Rules are explicit per contest. `maxCenterSpan` optionally limits block-center span on each axis in world units; it is **not** a mesh bounding-box measurement. Fixed checkpoints use block ID, position, and tolerance. Author-medal time is an asserted file value, not independent proof of a legitimate driven time.

Completed valid and invalid revisions are cached by Workshop update timestamp/size, rules hash, and validator version. Missing metadata and transient errors retain prior playlist and retry next run. `--force` provides an operator escape hatch if upstream timestamps prove unreliable.

Only selected, valid, playable submissions enter deterministic playlists. Private tables: `level_submission_contest`, `level_submissions`, `level_submission_validation`, `level_submission_playlist`, `level_submission_playlist_entry`. Full payloads are private immutable objects, not stored in PostgreSQL. No public GraphQL/API exposure is added.

Locked/configured-closed contests freeze the last published version. Archiving alone does not close submissions. Explicit `reopen: true` works only after the thread is unlocked and `closed` is false. Frozen revisions remain playable after Workshop changes. Publication failures retry using persisted digest/message identity; send replacement before deleting the old bot-owned playlist message. There are no judge reports.

## Showcase room

Add a room to existing lobby-host JSON:

```json
{
  "key": "zsl-submissions",
  "profile": { "type": "zsl-submissions", "threadId": "3" },
  "room": { "name": "ZSL Level Contest Submissions", "isPublic": true, "maxPlayers": 64 },
  "roundTimeSeconds": 300,
  "assetPollMs": 30000,
  "reconnectMaxMs": 60000,
  "messageRefreshMs": 60000
}
```

Use the same thread as inspector's `activeShowcaseThreadId`; that field validates operator intent but does not rewrite lobby-host configuration. Both files must be updated explicitly when switching contests.

Room polls immutable database playlist versions every 30 seconds, lazily downloads validated payloads, follows server next-index requests, and never runs SteamCMD or contacts Discord. Empty published playlist privatizes/disconnects the room; it must not fall back to A-01. TotW/TotM single-track encoding stays unchanged. No voting, event scheduling, or result ingestion is included.
