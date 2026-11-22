SELECT count(*) FROM public.lobby_listing WHERE NOT is_public AND first_seen<'2001-01-03Z' AND coalesce(closed_at,last_seen)>='2001-01-02Z'
