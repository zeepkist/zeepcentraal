INSERT INTO public.zsl_level(id_round,id_level,date_created,date_updated) VALUES ($1,$2,clock_timestamp(),clock_timestamp()) RETURNING id
