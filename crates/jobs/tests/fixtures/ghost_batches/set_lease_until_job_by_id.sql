UPDATE zc_jobs.job SET lease_until=clock_timestamp()+interval '120 seconds' WHERE id=$1
