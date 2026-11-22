SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='record' AND column_name='record_eligible')
