SELECT zc_jobs.enqueue($1,$2,$3,$4,$5,$6,clock_timestamp()+$7*interval '1 millisecond')::text AS id, $2::text AS task_identifier, 0::integer AS attempts, $6::integer AS max_attempts
