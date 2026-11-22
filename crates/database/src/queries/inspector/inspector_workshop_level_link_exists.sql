SELECT EXISTS(SELECT 1 FROM public.level l JOIN public.level_item i ON i.id_level=l.id WHERE l.xx_hash=$1 AND i.workshop_id=$2) AS value
