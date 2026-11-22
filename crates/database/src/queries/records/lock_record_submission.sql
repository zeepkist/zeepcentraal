SELECT pg_advisory_xact_lock($1,$2),clock_timestamp()::text AS accepted_at
