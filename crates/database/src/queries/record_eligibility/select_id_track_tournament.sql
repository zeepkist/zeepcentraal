SELECT id FROM public.track_tournament WHERE id_level=$1 AND finalized_at IS NULL ORDER BY id FOR UPDATE
