SELECT count(*) FROM public.user_point_contribution WHERE id_level=$1 AND contribution_rank=1 AND player_decayed_points>0
