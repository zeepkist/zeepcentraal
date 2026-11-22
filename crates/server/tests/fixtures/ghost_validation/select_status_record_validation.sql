SELECT status FROM zc_private.record_validation WHERE id_record=(SELECT id FROM public.record WHERE id_user<>$1)
