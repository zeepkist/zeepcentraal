![Managed room lifecycle](generated/lobby-lifecycle.svg)

![Receipt, transfer, and publication](generated/lobby-receipt.svg)

![ZSL session phases](generated/lobby-zsl.svg)

`zsl-submissions` uses its own room and unique config `key`. It can run beside
`zsl-practice`, `zsl`, or their combined room, including for the same `roundId`.
Only enabled `zsl-practice` and `zsl` profiles with the same `roundId` share one
physical room. That pair uses the practice config `key`; submissions stays separate.

## ZSL round setup

1. Open `/admin/zsl`. Create or select a points structure and season. Save the
   round, both timeslots, and any contest dates. Enter dates with a UTC offset.
2. Configure the profiles in the lobby host file. Set the tournament profile to
   `{"type":"zsl","roundId":50}` with the actual round ID and
   `roundTimeSeconds: 420`. Use `{"type":"zsl-practice","roundId":50}` for
   practice with the same round ID. Keep the practice room's key and settings
   when updating an existing deployment. Existing practice URLs serve as a
   fallback until an admin revision is verified. Keep inspector rules in its config.
3. Upload separate practice and tournament `.zeeplist` files in the round's
   playlist panel. Omit the break from practice. Include it after Track 7 in
   the tournament playlist. Warmup preparation is automatic. Use
   **Regenerate warmup** to request a fresh selection. Keep the lobby host
   running so it can verify payloads before opening the room.
4. Check practice readiness before opening practice. Check warmup and tournament
   readiness before the 24-hour check. During preparation,
   **Refresh status** shows the latest result. For a level failure, use its
   playlist position, Workshop ID and UID to correct the source. Upload the
   corrected file or retry after fixing Workshop availability.

Readiness checks appear in the admin panel. Jobs also log
`ZSL playlists need attention before start` with the round, timeslot and lead
time.

## Lobby connection diagnostics

Enable `ZC_LOBBY_HOST_RAW_CHAT=1` on the lobby-host process to capture exact outbound
application bytes for `/servermessage`, `/settime`, and `/joinmessage`. Restart the
process to apply the setting. The default records digests and metadata. Each
connection retains up to 32 records and 64 KiB of raw bytes. Raw overlay captures
can contain player names. Limit access to incident logs and disable raw capture
after collecting evidence.

Search by the `connection` field. Per-packet debug events at publication admission
also carry SHA-256. Match that digest to packet history at transport shutdown.
Abnormal termination dumps packet history at most once per minute per managed
room. The decoded remote reason remains attached to the internal error. Logs
sanitize remote text and error chains.

```text
Game connection terminated connection=<id> lobby=<join-id> profile=totd origin="remote" classification="remote_disconnect" retry_ms=Some(31800)
Recent outbound game packet connection=<id> packet_type="CHAT_MESSAGE" payload_bytes=1404 sha256=<digest> fragmented=true outcome="acknowledged" raw_status="omitted"
```

An ACK confirms that Lidgren acknowledged every chunk. Compare captured raw bytes
with the server's reassembled application bytes to locate divergence. The first
and last chunk records contain the transfer ID, group, sequence, chunk size and
write timing. Publication admission, UDP write, and ACK are separate milestones.

The broker serializes room assignments through game handshake per process.
Rejected joins retain the master result code. Ambiguous master responses recycle
the master connection. Reconnects use capped exponential backoff and stable-host
decay. The supported disconnect write does not provide a membership acknowledgement.

Tournament overlays send after the first valid countdown sample and refresh at
the configured message interval.
