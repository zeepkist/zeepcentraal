INSERT INTO public.level(hash,xx_hash,simhash)
        SELECT 'large-'||id,lpad(to_hex(id),32,'0'),id::bigint FROM generate_series(1000,101000) id;
