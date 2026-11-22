SELECT history.change_type FROM public.lobby_history history JOIN public.lobby value ON value.id=history.lobby_id WHERE value.master_id=$1 ORDER BY history.id
