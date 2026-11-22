SELECT count(*) FROM public.record r WHERE NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail')
