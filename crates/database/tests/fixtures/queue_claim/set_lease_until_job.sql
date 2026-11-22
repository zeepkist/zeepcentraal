UPDATE zc_jobs.job SET lease_until=clock_timestamp()-interval '1 second'; UPDATE pgmq.q_zeepcentraal_{{lane}} SET vt=clock_timestamp()-interval '1 second'
