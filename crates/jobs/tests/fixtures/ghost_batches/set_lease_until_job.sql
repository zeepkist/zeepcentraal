UPDATE zc_jobs.job SET lease_until=clock_timestamp()-interval '1 second' WHERE id=$1
