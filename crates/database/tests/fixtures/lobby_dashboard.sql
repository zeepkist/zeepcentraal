-- Fake local data only. Caller verifies disposable database name.
INSERT INTO public."user" (steam_id,steam_name,banned)
VALUES (76561198000000000,'Lobby Test Host',false) ON CONFLICT(steam_id) DO NOTHING;
INSERT INTO public.lobby(id,master_id,room_name,host_id,players,player_limit,is_public,peak_players,peak_time,first_seen,last_seen,closed_at)
OVERRIDING SYSTEM VALUE VALUES
 (1001,'lobby-dashboard-test-active','Test active room',76561198000000000,2,8,true,6,'2001-01-01 01:00Z','2001-01-01 00:00Z','2001-01-02 00:00Z',NULL),
 (1002,'lobby-dashboard-test-closed','Private midnight room',76561198000000000,3,12,false,12,'2001-01-02 00:15Z','2001-01-01 23:30Z','2001-01-02 00:30Z','2001-01-02 00:35Z'),
 (1003,'lobby-dashboard-test-reopened','Reopened room',76561198000000000,1,0,true,4,'2001-01-01 00:00Z','2001-01-01 00:00Z','2001-01-03 00:00Z',NULL)
ON CONFLICT(master_id) DO NOTHING;
INSERT INTO public.lobby_history(lobby_id,host_id,change_type,room_name,players,player_limit,is_public,observed_at)
SELECT 1001,76561198000000000,CASE WHEN value=0 THEN 'opened' ELSE 'updated' END,
 CASE WHEN value<500 THEN 'Original room name' ELSE 'Test active room' END,
 value%7,CASE WHEN value<500 THEN 8 ELSE 12 END,true,
 '2001-01-01 00:00Z'::timestamptz+value*interval '1 minute'
FROM generate_series(0,1000) value;
INSERT INTO public.lobby_history(lobby_id,host_id,change_type,room_name,players,player_limit,is_public,observed_at) VALUES
 (1002,76561198000000000,'opened','Private midnight room',3,12,false,'2001-01-01 23:30Z'),
 (1002,76561198000000000,'updated','Private midnight room',12,12,false,'2001-01-02 00:15Z'),
 (1002,76561198000000000,'closed','Private midnight room',3,12,false,'2001-01-02 00:35Z'),
 (1003,76561198000000000,'opened','Reopened room',4,0,true,'2001-01-01 00:00Z'),
 (1003,76561198000000000,'closed','Reopened room',4,0,true,'2001-01-01 01:00Z'),
 (1003,76561198000000000,'reopened','Reopened room',1,0,true,'2001-01-03 00:00Z');
INSERT INTO public.lobby_stats(players,players_in_rooms,rooms,date_created,date_updated) VALUES
 (100,20,2,'2001-01-01 00:00Z','2001-01-01 00:00Z'),
 (200,30,3,'2001-01-01 01:00Z','2001-01-01 01:00Z'),
 (90,80,4,'2001-01-01 01:00Z','2001-01-01 01:00Z'),
 (50,10,10,'2001-01-01 02:00Z','2001-01-01 02:00Z');
INSERT INTO public.lobby_stats(players,players_in_rooms,rooms,date_created,date_updated)
SELECT 100+value%101,50+value%51,5+value%10,now()-interval '24 hours'+value*interval '5 minutes',now()-interval '24 hours'+value*interval '5 minutes'
FROM generate_series(0,288) value;
