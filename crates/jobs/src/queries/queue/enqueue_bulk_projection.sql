SELECT zc_jobs.enqueue('bulk',$1,$2,$3,$4,$5,clock_timestamp())::text AS id, $1::text AS task_identifier, 0::integer AS attempts, $5::integer AS max_attempts
