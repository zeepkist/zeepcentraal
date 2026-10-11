-- Restore old polling semantics for resumable broadcasts, preserving historical rows.
UPDATE streamkist.streams SET is_live=true,
    snapshot=jsonb_set(snapshot - 'category_stopped','{ended_at}','null'::jsonb)
WHERE canonical AND tracking_state IN ('category_paused','limit_paused');
UPDATE streamkist.streams SET snapshot=snapshot - 'category_stopped';
DROP INDEX streamkist.streamkist_streams_tracking;
DROP INDEX streamkist.streamkist_streams_canonical;
ALTER TABLE streamkist.streams DROP COLUMN activation_pending, DROP COLUMN tracking_state,
    DROP COLUMN canonical, DROP COLUMN policy_watch_id, DROP COLUMN channel_id, DROP COLUMN guild_id;
ALTER TABLE streamkist.channels DROP COLUMN allow_category_switches, DROP COLUMN minimum_viewers;
