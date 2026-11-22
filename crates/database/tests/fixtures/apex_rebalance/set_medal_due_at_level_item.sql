UPDATE public.level_item SET medal_due_at=now()-interval '1 day' WHERE id=2; SELECT zc_private.refresh_level_medals(2)
