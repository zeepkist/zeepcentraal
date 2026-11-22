SELECT id_user,id_level,id_record,level_position::bigint AS level_position,level_points,level_decayed_points FROM public.user_point_contribution WHERE id_user=ANY($1)
