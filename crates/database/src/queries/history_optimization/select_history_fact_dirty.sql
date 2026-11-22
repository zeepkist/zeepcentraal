SELECT to_jsonb(state)-'original_view' || jsonb_build_object('dirty_records',(SELECT count(*) FROM zc_private.history_fact_dirty)) AS value FROM zc_private.history_fact_rollout state
