SELECT count(*) FROM information_schema.columns WHERE column_name IN ('checked_at','validation_inputs_updated_at') AND table_schema IN ('public','zc_private')
