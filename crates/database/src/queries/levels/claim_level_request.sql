INSERT INTO public.level_request(workshop_id,hash) VALUES ($1,$2) ON CONFLICT (workshop_id) DO NOTHING RETURNING id
