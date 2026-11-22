SELECT col_description('public."user"'::regclass,attnum) FROM pg_attribute WHERE attrelid='public."user"'::regclass AND attname='role'
