INSERT INTO public.level_request(workshop_id,hash) SELECT $2,$3 WHERE NOT EXISTS(SELECT 1 FROM public.level_metadata WHERE id_level=$1) ON CONFLICT (workshop_id) DO NOTHING RETURNING id
