SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(j) ORDER BY id) FROM zc_jobs.job j),(SELECT jsonb_agg(to_jsonb(q) ORDER BY msg_id) FROM pgmq.q_zeepcentraal_bulk q))::text
