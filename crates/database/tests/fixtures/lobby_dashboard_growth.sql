-- Synthetic growth data for isolated query-plan tests only.
INSERT INTO public.lobby_stats(players,players_in_rooms,rooms,date_created,date_updated) SELECT 100+value%101,50+value%51,5+value%10,'2010-01-01Z'::timestamptz+value*interval '5 minutes','2010-01-01Z'::timestamptz+value*interval '5 minutes' FROM generate_series(1,78900) value;
INSERT INTO public.lobby(id,master_id,room_name,host_id,players,player_limit,is_public,peak_players,peak_time,first_seen,last_seen,closed_at) OVERRIDING SYSTEM VALUE SELECT 100000+value,'lobby-benchmark-'||value,'Benchmark room '||value,76561198000000000,value%65,64,value%2=0,value%65,'2020-01-01Z','2020-01-01Z'::timestamptz+value*interval '5 minutes','2020-01-01Z'::timestamptz+value*interval '5 minutes'+interval '90 minutes','2020-01-01Z'::timestamptz+value*interval '5 minutes'+interval '2 hours' FROM generate_series(1,30000) value;
INSERT INTO public.lobby_history(lobby_id,host_id,change_type,room_name,players,player_limit,is_public,observed_at) SELECT 1001,76561198000000000,'updated','Benchmark room',value%65,64,true,'2002-01-01Z'::timestamptz+value*interval '1 minute' FROM generate_series(1,10010) value;
ANALYZE public.lobby_stats;
ANALYZE public.lobby;
ANALYZE public.lobby_history;
