SELECT count(*) AS count FROM zc_jobs.job WHERE task='updatePlayerScores' AND payload='{"silent":true}'::jsonb
