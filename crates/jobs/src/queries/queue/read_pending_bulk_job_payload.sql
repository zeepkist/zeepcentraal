SELECT payload FROM zc_jobs.job WHERE lane='bulk' AND job_key=$1 AND NOT running ORDER BY id LIMIT 1
