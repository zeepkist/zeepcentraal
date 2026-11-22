INSERT INTO public.level(hash,xx_hash,date_created) VALUES('fixture',repeat('A',32),clock_timestamp()-interval '30 days') RETURNING id
