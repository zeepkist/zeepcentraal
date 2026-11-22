SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE task='updatePlayerScore' AND payload->>'idUser'='1')
