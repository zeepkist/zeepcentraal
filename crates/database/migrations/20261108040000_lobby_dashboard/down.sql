DROP TRIGGER trg__live_query_invalidate ON public.lobby_stats;
DROP TRIGGER trg__live_query_invalidate ON public.lobby_history;
DROP TRIGGER trg__live_query_invalidate ON public.lobby;
DROP FUNCTION public.lobby_occupancy_timeline(bigint,integer);
DROP VIEW public.lobby_listing;
