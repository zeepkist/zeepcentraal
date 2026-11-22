SELECT zc_jobs.enqueue('fast','refreshGlobalMetrics','{}','fixture',NULL,3); SELECT * FROM zc_jobs.claim('fast',1,120)
