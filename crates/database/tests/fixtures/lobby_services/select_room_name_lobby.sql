SELECT l.room_name, h.room_name, h.change_type, l.is_public, h.is_public FROM public.lobby l JOIN public.lobby_history h ON h.lobby_id=l.id WHERE l.master_id=$1 ORDER BY h.id
