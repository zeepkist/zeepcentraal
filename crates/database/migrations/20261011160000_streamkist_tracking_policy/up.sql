ALTER TABLE streamkist.channels
    ADD COLUMN minimum_viewers integer NOT NULL DEFAULT 0 CHECK (minimum_viewers >= 0),
    ADD COLUMN allow_category_switches boolean NOT NULL DEFAULT false;

ALTER TABLE streamkist.streams
    ADD COLUMN guild_id text REFERENCES streamkist.guilds(guild_id),
    ADD COLUMN channel_id text,
    ADD COLUMN policy_watch_id bigint REFERENCES streamkist.channels(id),
    ADD COLUMN canonical boolean NOT NULL DEFAULT true,
    ADD COLUMN tracking_state text NOT NULL DEFAULT 'active'
        CHECK (tracking_state IN ('active', 'category_paused', 'limit_paused', 'finished')),
    ADD COLUMN activation_pending boolean NOT NULL DEFAULT false;

UPDATE streamkist.streams s SET guild_id=c.guild_id, channel_id=c.channel_id,
    policy_watch_id=c.id, tracking_state=CASE WHEN s.is_live THEN 'active' ELSE 'finished' END
FROM streamkist.channels c WHERE c.id=s.watch_id;
ALTER TABLE streamkist.streams ALTER COLUMN guild_id SET NOT NULL,
    ALTER COLUMN channel_id SET NOT NULL, ALTER COLUMN policy_watch_id SET NOT NULL;

WITH ranked AS (
    SELECT id, row_number() OVER (
        PARTITION BY guild_id,channel_id,stream_id
        ORDER BY (message_id IS NOT NULL) DESC,
            CASE WHEN message_id ~ '^[0-9]+$' THEN message_id::numeric END NULLS LAST,
            created_at,id
    ) AS position, max(peak_viewers) OVER (
        PARTITION BY guild_id,channel_id,stream_id
    ) AS peak FROM streamkist.streams
)
UPDATE streamkist.streams s SET canonical=(r.position=1),
    peak_viewers=CASE WHEN r.position=1 THEN r.peak ELSE s.peak_viewers END,
    snapshot=CASE WHEN r.position=1 THEN jsonb_set(s.snapshot,'{peak_viewers}',to_jsonb(r.peak)) ELSE s.snapshot END
FROM ranked r WHERE r.id=s.id;

CREATE UNIQUE INDEX streamkist_streams_canonical
    ON streamkist.streams(guild_id,channel_id,stream_id) WHERE canonical;
CREATE INDEX streamkist_streams_tracking ON streamkist.streams(guild_id,tracking_state)
    WHERE tracking_state<>'finished' OR activation_pending;
