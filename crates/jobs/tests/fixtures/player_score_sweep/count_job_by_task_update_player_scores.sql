SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE task='updatePlayerScores' AND payload->>'phase'='ranks' AND attempts=0 AND NOT running
