SELECT zc_jobs.enqueue('bulk',$1,$2,$3,$4,$5,clock_timestamp()+$6*interval '1 millisecond')
