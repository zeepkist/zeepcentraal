SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE task='updateLevelScore' AND (payload->>'idLevel')::integer=$1)
