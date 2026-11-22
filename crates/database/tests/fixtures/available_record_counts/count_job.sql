SELECT count(*) FROM zc_jobs.job WHERE task='updatePlayerScore' AND payload->>'idUser' IN ('1','2')
