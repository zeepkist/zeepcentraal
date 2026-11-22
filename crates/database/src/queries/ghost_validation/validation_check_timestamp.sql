SELECT id AS id_level,validation_inputs_updated_at::text AS checked_at,validation_metadata_updated_at::text AS checked_metadata_at FROM public.level WHERE id=$1
