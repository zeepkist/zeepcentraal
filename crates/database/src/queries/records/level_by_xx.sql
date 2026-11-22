SELECT id,hash,xx_hash,adventure,has_records,record_count,publicly_visible FROM public.level WHERE xx_hash=$1 LIMIT 1 FOR UPDATE
