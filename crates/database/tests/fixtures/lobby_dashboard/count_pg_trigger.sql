SELECT count(*) FROM pg_trigger WHERE tgname='trg__live_query_invalidate' AND tgrelid IN ('public.lobby'::regclass,'public.lobby_history'::regclass,'public.lobby_stats'::regclass)
