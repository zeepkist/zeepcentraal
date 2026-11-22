SELECT zc_jobs.enqueue('bulk','auditRecordGhosts',$1,$2,'ghost-audit',3,clock_timestamp())
