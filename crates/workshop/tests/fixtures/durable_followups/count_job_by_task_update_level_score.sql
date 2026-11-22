SELECT count(*) FROM zc_jobs.job WHERE task='updateLevelScore' AND (payload->>'idLevel')::integer=ANY($1)
