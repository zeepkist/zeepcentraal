SELECT set_config('zc.traceparent','',false),set_config('zc.tracestate','',false); SELECT zc_jobs.enqueue('fast','refreshGlobalMetrics','{}','fixture',NULL,3)
