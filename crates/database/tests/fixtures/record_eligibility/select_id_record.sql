SELECT r.id,r.time FROM public.record r WHERE id_level=20000 AND zc_private.record_is_eligible(r.id) ORDER BY r.time,r.id LIMIT 20
