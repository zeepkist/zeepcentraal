INSERT INTO public."user"(steam_id,steam_name,banned) VALUES (76561198000000000,'Backfill Test Host',false);
         WITH rooms AS (
             INSERT INTO public.lobby(master_id,room_name,host_id,players,player_limit,is_public,
                 peak_players,peak_time,first_seen,last_seen,closed_at)
             SELECT master_id,room_name,76561198000000000,1,8,is_public,1,now(),now(),now(),closed_at
             FROM (VALUES ('backfill-removed','Private packet name',false,now()),
                          ('backfill-inferred','Inferred room',false,now()+interval '1 minute'),
                          ('backfill-active','Active room',false,NULL),
                          ('backfill-public','Public room',true,now()))
               AS sample(master_id,room_name,is_public,closed_at)
             RETURNING id,room_name,host_id,players,player_limit,is_public,closed_at
         )
         INSERT INTO public.lobby_history(lobby_id,host_id,change_type,room_name,players,
             player_limit,is_public,observed_at)
         SELECT id,host_id,change_type,room_name,players,player_limit,is_public,now()
         FROM rooms CROSS JOIN (VALUES ('opened'),('closed')) AS events(change_type)
         WHERE change_type='opened' OR closed_at IS NOT NULL;
