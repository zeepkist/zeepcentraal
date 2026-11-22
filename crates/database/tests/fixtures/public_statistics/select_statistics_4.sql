SELECT jsonb_build_array(records_yesterday,records_last_month,personal_bests_yesterday,personal_bests_last_month,
      world_records_yesterday,world_records_last_month,levels_yesterday,levels_last_month,votes_yesterday,votes_last_month,
      active_players_yesterday,active_players_last_month)::text FROM public.statistics
