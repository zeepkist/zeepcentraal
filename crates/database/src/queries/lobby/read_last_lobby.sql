SELECT id,master_id,room_name,host_id,players,player_limit,is_public,closed_at IS NOT NULL AS closed FROM public.lobby WHERE master_id IN (SELECT jsonb_array_elements_text($1)) LIMIT 1
