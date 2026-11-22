SELECT to_regclass('public.__diesel_schema_migrations') IS NULL AS public_gone, count(*)::bigint AS versions FROM zc_private.__diesel_schema_migrations
