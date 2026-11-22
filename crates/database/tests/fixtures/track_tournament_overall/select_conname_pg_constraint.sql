SELECT conname::text FROM pg_constraint WHERE conrelid='public.track_tournament_overall_period'::regclass AND contype='c' AND cardinality(conkey)=2
