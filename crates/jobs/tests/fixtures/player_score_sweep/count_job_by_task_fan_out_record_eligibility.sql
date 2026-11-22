SELECT count(*)::bigint AS count FROM zc_jobs.job WHERE task='fanOutRecordEligibility' AND lock_group='eligibility-player-fanout'
