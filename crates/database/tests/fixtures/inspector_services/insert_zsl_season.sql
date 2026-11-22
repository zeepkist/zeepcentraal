INSERT INTO public.zsl_season(id_points_structure,name,start_date,end_date) VALUES($1,'Fixture',now(),now()+interval '1 year') RETURNING id
