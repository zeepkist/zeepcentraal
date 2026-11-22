SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='level' AND column_name='validation_metadata_updated_at')
