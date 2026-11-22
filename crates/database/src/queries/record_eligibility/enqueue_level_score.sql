SELECT zc_jobs.enqueue('bulk','updateLevelScore',jsonb_build_object('idLevel',$1::integer),'update-level-score:'||$1,'level-maintenance-shard:'||($1%4),3,clock_timestamp())
