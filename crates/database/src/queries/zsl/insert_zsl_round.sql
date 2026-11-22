INSERT INTO public.zsl_round (id_season,round,name,workshop_id,event_date,date_created) VALUES ($1,$2,$3,$4,$5::timestamptz,clock_timestamp()) RETURNING id
