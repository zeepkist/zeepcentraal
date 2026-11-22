SELECT medal_due_at>now()+interval '6 days' AND validation_time_expert IS NULL FROM public.level_item WHERE id=2
