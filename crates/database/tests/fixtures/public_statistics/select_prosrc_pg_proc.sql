SELECT prosrc FROM pg_proc
             WHERE oid='zc_private.compute_global_metrics(timestamptz)'::regprocedure
