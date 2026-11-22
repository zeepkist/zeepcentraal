INSERT INTO public.zsl_round(id_season,name,round,workshop_id,event_date) VALUES($1,'No stored votes',2,0,now()) RETURNING id
