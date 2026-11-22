WITH due AS (
    SELECT r.id AS round_id, slot.timeslot, slot.starts_at, threshold.hours
    FROM public.zsl_round r
    CROSS JOIN LATERAL (VALUES (1, r.event_date), (2, r.event2_date)) slot(timeslot, starts_at)
    CROSS JOIN (VALUES (24), (1)) threshold(hours)
    WHERE r.event2_date IS NOT NULL AND slot.starts_at > now()
      AND slot.starts_at - make_interval(hours => threshold.hours) <= now()
      AND (threshold.hours = 1 OR slot.starts_at > now() + interval '1 hour')
      AND EXISTS (
          SELECT FROM (VALUES ('warmup'), ('tournament')) playlist(kind)
          WHERE NOT (
              (playlist.kind = 'tournament' AND EXISTS (
                  SELECT FROM zc_private.zsl_tournament_state ts
                  WHERE ts.id_round = r.id AND ts.state->'pinned' <> 'null'::jsonb
                  AND (ts.state->'started' @> '[true]'::jsonb OR ts.state->>'phase' = 'tournament'
                      OR coalesce((ts.state->'progress'->>0)::integer, 0) > 0
                      OR coalesce((ts.state->'progress'->>1)::integer, 0) > 0)
              ))
              OR EXISTS (
                  SELECT FROM zc_private.zsl_playlist_revision revision
                  WHERE revision.round_id = r.id AND revision.kind = playlist.kind AND revision.state = 'verified'
                  AND (playlist.kind = 'warmup' OR NOT EXISTS (
                      SELECT FROM zc_private.zsl_playlist_revision newer
                      WHERE newer.round_id = r.id AND newer.kind = playlist.kind AND newer.id > revision.id
                  ))
              )
          )
      )
)
INSERT INTO zc_private.zsl_readiness_alert (round_id, timeslot, starts_at, hours)
SELECT round_id, timeslot, starts_at, hours FROM due ON CONFLICT DO NOTHING
RETURNING round_id, timeslot, starts_at::text AS starts_at, hours
