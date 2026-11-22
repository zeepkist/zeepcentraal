UPDATE zc_jobs.job SET lease_until=clock_timestamp()+interval '120 seconds' WHERE lane='bulk' AND id={{job_id}}
