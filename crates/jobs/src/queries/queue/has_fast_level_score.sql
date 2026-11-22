SELECT EXISTS(SELECT 1 FROM zc_jobs.job WHERE lane='fast' AND task='updateLevelScore' AND job_key=$1) AS ok
