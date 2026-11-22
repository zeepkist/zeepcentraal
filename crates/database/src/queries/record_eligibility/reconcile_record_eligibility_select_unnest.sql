SELECT coalesce(bool_and(pg_try_advisory_xact_lock(-1861284952,id)),true) AS value FROM (SELECT id FROM unnest($1::integer[]) id ORDER BY id) targets
