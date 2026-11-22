INSERT INTO public.level(hash,xx_hash,adventure) VALUES('fixture-hash',$1,false) ON CONFLICT(xx_hash) DO NOTHING
