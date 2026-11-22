SELECT * FROM public.lobby_listing WHERE closed_at IS NOT NULL AND first_seen<'2020-04-01Z' AND coalesce(closed_at,last_seen)>='2020-03-01Z' ORDER BY closed_at DESC,id DESC LIMIT 25
