SELECT players,peak_players,closed_at IS NOT NULL FROM public.lobby WHERE master_id=$1
