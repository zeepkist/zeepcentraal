SELECT count(*)::int FROM zc_jobs.job WHERE task='updateLevelRecordCounts' AND payload->>'idLevel'='2'
