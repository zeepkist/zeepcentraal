SELECT jsonb_build_array((SELECT jsonb_agg(j ORDER BY id) FROM zc_jobs.job j),(SELECT jsonb_agg(q ORDER BY msg_id) FROM pgmq.q_zeepcentraal_bulk q))::text
