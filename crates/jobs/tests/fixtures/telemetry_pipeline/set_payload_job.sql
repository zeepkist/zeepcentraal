UPDATE zc_jobs.job SET payload='{}' WHERE job_key='fixture'; UPDATE zc_jobs.job SET running=false,payload='{"deferCount":1}' WHERE job_key='fixture'
