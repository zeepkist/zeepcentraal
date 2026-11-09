-- Only loaded by guarded disposable Adventure verification script.
TRUNCATE public."user",public.level,public.workshop_item,zc_jobs.job RESTART IDENTITY CASCADE;
INSERT INTO public."user"(id,steam_id,steam_name,banned) OVERRIDING SYSTEM VALUE
 SELECT i,76561198000000000+i,'Adventure Player '||i,false FROM generate_series(1,65) i;
INSERT INTO public.level(id,hash,xx_hash,adventure) OVERRIDING SYSTEM VALUE
 SELECT i,'adventure-fixture-'||i,lpad(i::text,32,'0'),true FROM generate_series(1,18) i;
INSERT INTO public.workshop_item(workshop_id,author_id,name,image_url) VALUES(0,76561198000000001,'Adventure fixture','');
INSERT INTO public.level_item(id,id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
 OVERRIDING SYSTEM VALUE
 SELECT i,i,0,76561198000000001,name,'','fixture',CASE WHEN i=1 THEN 'ea1' WHEN i=2 THEN 'ea2' ELSE 'adventure-'||i END,10,11,12,13,false,now(),now()
 FROM unnest(ARRAY['A-01','A-02','B-02','C-01','CL-01','D-01','E-01','EZ-01','F-01','FL-01','G-01','H-01','I-01','L-01','OR-01','X-01','XG-01','Y-01']) WITH ORDINALITY x(name,i);
INSERT INTO public.level_item(id,id_level,workshop_id,author_id,name,image_url,file_author,file_uid,
 validation_time_author,validation_time_gold,validation_time_silver,validation_time_bronze,deleted,created_at,updated_at)
 OVERRIDING SYSTEM VALUE VALUES(19,1,0,76561198000000001,'B-01','','fixture','shared-b',10,11,12,13,false,now(),now());
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
 SELECT i,i,1,CASE WHEN i<=2 THEN 60 ELSE 1+i::real/100 END,'test','test' FROM generate_series(1,65) i;
INSERT INTO public.record(id,id_user,id_level,time,game_version,mod_version) OVERRIDING SYSTEM VALUE
 VALUES(66,1,2,60,'test','test'),(67,2,2,60,'test','test');
INSERT INTO public.personal_best_global(id_user,id_level,id_record) SELECT id_user,id_level,id FROM public.record;
INSERT INTO public.world_record_global(id_user,id_level,id_record) VALUES(3,1,3),(1,2,66);
-- Fake web session exercises the real verified-session playlist route.
INSERT INTO public.auth(id_user,access_token,access_token_expiry,refresh_token_hash,refresh_token_expiry,provider)
 VALUES(65,'fake-adventure-access',extract(epoch FROM now())::bigint+3600,
 encode(sha256('fake-adventure-refresh'::bytea),'hex'),extract(epoch FROM now())::bigint+7200,'steam');
INSERT INTO public."user"(id,steam_id,steam_name,banned) OVERRIDING SYSTEM VALUE VALUES(66,76561198000000066,'New Adventure Player',false);
INSERT INTO public.auth(id_user,access_token,access_token_expiry,refresh_token_hash,refresh_token_expiry,provider)
 VALUES(66,'fake-adventure-zero-access',extract(epoch FROM now())::bigint+3600,
 encode(sha256('fake-adventure-zero-refresh'::bytea),'hex'),extract(epoch FROM now())::bigint+7200,'steam');
-- Replace only this disposable view; never read external supporter sources.
CREATE OR REPLACE VIEW public.donations AS SELECT true AS is_subscription_payment,'Fixture supporter'::text AS tier_name,900000000000000065::bigint AS discord_userid;
GRANT SELECT ON public.donations TO zeepcentraal_graphql;
UPDATE public."user" SET discord_id=900000000000000065 WHERE id=65;
