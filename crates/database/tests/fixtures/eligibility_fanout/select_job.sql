SELECT array_agg((payload->>'idLevel')::integer ORDER BY (payload->>'idLevel')::integer) FROM zc_jobs.job WHERE task='updateLevelScore'
