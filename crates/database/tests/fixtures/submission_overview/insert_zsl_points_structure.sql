
INSERT INTO public.zsl_points_structure(id,name,points,minimum_points,best_of) VALUES(1,'Fixture',ARRAY[10],1,1);
INSERT INTO public.zsl_season(id,id_points_structure,name) VALUES(1,1,'Fixture');
INSERT INTO public.zsl_round(id,id_season,name,round,event_date,submission_start,submission_end) VALUES
 (1,1,'Current',1,now(),now()-interval '1 day',now()+interval '1 day'),
 (2,1,'Future',2,now(),now()+interval '1 day',now()+interval '2 days');
INSERT INTO public."user"(steam_id,steam_name) VALUES(76561198000000001,'Alice'),(76561198000000002,'Bob');
INSERT INTO public.level(id,hash,xx_hash) VALUES(1,'legacy','fixture-hash');
INSERT INTO public.level_points(id_level,points,rating) VALUES(1,321,0.8);
INSERT INTO public.record(id_level) VALUES(1),(1);
INSERT INTO public.personal_best_global(id_level) VALUES(1);
INSERT INTO public.vote(id_level) VALUES(1),(1),(1),(1),(1);
INSERT INTO zc_private.level_submission_contest(id_zsl_round) VALUES(1),(2);
INSERT INTO zc_private.level_submissions(id_contest,workshop_id,authors,state,revision,latest_validation_id,level_hash) VALUES
 (1,9007199254740993,ARRAY['76561198000000001','76561198000000002'],'selected',1,1,'fixture-hash'),
 (1,2,ARRAY['76561198000000003'],'selected',1,2,'fixture-hash'),
 (1,3,ARRAY['76561198000000004'],'selected',2,3,'fixture-hash'),
 (1,4,ARRAY['76561198000000005'],'selected',1,NULL,NULL),
 (1,5,ARRAY['76561198000000006'],'withdrawn',1,4,'fixture-hash'),
 (2,6,ARRAY['76561198000000007'],'selected',1,NULL,NULL);
INSERT INTO zc_private.level_submission_validation(id_submission,submission_revision,valid,file_uid,payload) VALUES
 (1,1,true,'uid','{"uid":"uid","name":"Accepted","sha256":"verified"}'),
 (2,1,false,'uid2','{"uid":"uid2","name":"Invalid","sha256":"verified"}'),
 (3,1,true,'uid3','{"uid":"uid3","name":"Stale","sha256":"verified"}'),
 (5,1,true,'uid4','{"uid":"uid4","name":"Withdrawn","sha256":"verified"}');
