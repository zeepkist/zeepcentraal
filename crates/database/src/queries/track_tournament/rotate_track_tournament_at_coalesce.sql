SELECT COALESCE($1::text::timestamptz,clock_timestamp())::text AS observed_at
