
INSERT INTO public.zsl_points_structure(id,name,points,minimum_points,best_of) OVERRIDING SYSTEM VALUE VALUES(9000,'Fixture',ARRAY[10],1,1);
INSERT INTO public.zsl_season(id,id_points_structure,name,start_date,end_date) OVERRIDING SYSTEM VALUE VALUES(8,9000,'Season 8',now(),now()+interval '1 year');
INSERT INTO public.zsl_round(id,id_season,name,round,workshop_id,event_date,submission_start,submission_end,zsl_vote_end,cosmetic_vote_end) OVERRIDING SYSTEM VALUE VALUES(50,8,'Mixed Surfaces',1,123,'2026-10-11',now()-interval '22 days',now()-interval '1 day',now()+interval '6 days',now()+interval '30 days');
INSERT INTO public.zsl_round(id,id_season,name,round,workshop_id,event_date) OVERRIDING SYSTEM VALUE VALUES(51,8,'Another contest',2,0,'2026-11-11');
INSERT INTO public."user"(id,steam_id,steam_name) VALUES(9000,76561198000000099,'Fixture voter');
INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE VALUES(9000,'fixture-md5','announcement-fixture-xx',false);
INSERT INTO zc_private.level_submission_contest(id,id_zsl_round,state,rules,rules_hash,archive_object_key,archive_sha256,archive_size,finalized_at,frozen_at) OVERRIDING SYSTEM VALUE VALUES(9000,50,'frozen','{}','frozen-rules','inspector/workshop/frozen.tar.gz',repeat('a',64),42,now(),now());
INSERT INTO zc_private.level_submission_contest(id,id_zsl_round,state,rules,rules_hash) OVERRIDING SYSTEM VALUE VALUES(9001,51,'open','{}','other-rules');
INSERT INTO zc_private.level_submissions(id,id_contest,workshop_id,state,authors,level_hash) OVERRIDING SYSTEM VALUE VALUES(9000,9000,123,'selected',ARRAY['76561198000000001'],'announcement-fixture-xx');
INSERT INTO zc_private.level_submission_validation(id,id_submission,workshop_updated_at,workshop_file_size,validator_version,rules_hash,measurements,failures,valid,payload) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'2026-09-27',42,'1','frozen-rules','{}','[]',true,'{"name":"Frozen level"}');
UPDATE zc_private.level_submissions SET latest_validation_id=9000 WHERE id=9000;
INSERT INTO zc_private.level_submission_playlist(id,id_contest,digest,valid_count,object_key) OVERRIDING SYSTEM VALUE VALUES(9000,9000,'immutable',1,'inspector/playlists/frozen.zeeplist');
INSERT INTO zc_private.level_submission_playlist_entry(id_playlist,position,id_validation,workshop_id) VALUES(9000,0,9000,123);
UPDATE zc_private.level_submission_contest SET current_playlist_id=9000 WHERE id=9000;
INSERT INTO zc_private.level_submission_vote(id_contest,id_user,id_level,vote_type) VALUES(9000,9000,9000,1);
