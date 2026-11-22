INSERT INTO public.record (id_user,time,game_version,id_level,mod_version,splits,speeds,date_created,date_updated) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp(),clock_timestamp()) RETURNING id
