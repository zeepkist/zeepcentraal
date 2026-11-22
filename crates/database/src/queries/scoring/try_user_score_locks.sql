SELECT COALESCE(bool_and(pg_try_advisory_xact_lock($1,target.id)),true) AS value FROM (SELECT id FROM unnest($2::integer[]) value(id) ORDER BY id) target
