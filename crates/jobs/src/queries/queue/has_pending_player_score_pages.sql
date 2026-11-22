SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE task='updatePlayerScores' AND payload->>'phase' IS DISTINCT FROM 'ranks') AS ok
