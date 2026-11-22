INSERT INTO public.level(hash,xx_hash,adventure) VALUES($1,$2,$3) ON CONFLICT (xx_hash) DO NOTHING RETURNING id
