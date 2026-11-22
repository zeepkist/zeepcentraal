SELECT jsonb_agg(to_jsonb(v)-'report' ORDER BY id) AS data FROM zc_private.record_validation v
