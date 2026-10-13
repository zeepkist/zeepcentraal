-- Apply only to isolated synthetic benchmark database, before flag migration.
-- Preserve old archive while distributing 250000 recent records over 90 days.
ALTER TABLE public.record DISABLE TRIGGER USER;
UPDATE public.record SET date_created='2026-10-13T12:00:00Z'::timestamptz
 - (id%90)*interval '1 day' - (id%86400)*interval '1 second' WHERE id>3679757;
ALTER TABLE public.record ENABLE TRIGGER USER;
INSERT INTO public.record_statistic(id_record,ghost_version,distance,time,average_speed,average_gforce)
 SELECT id,6,(id%100+1)::real,20,10,1 FROM public.record ON CONFLICT(id_record) DO NOTHING;
-- Recent levels need eligible world records so full card fragments actually execute.
INSERT INTO public.world_record_global(id_user,id_level,id_record)
 SELECT DISTINCT ON(r.id_level) r.id_user,r.id_level,r.id FROM public.record r
 WHERE r.id>3679757 AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation v WHERE v.id_record=r.id AND v.status='fail')
 ORDER BY r.id_level,r.time,r.id ON CONFLICT(id_level) DO NOTHING;
INSERT INTO public.personal_best_global(id_user,id_level,id_record)
 SELECT id_user,id_level,id_record FROM public.world_record_global
 ON CONFLICT(id_user,id_level) DO NOTHING;
ANALYZE public.record;
ANALYZE public.record_statistic;
ANALYZE public.world_record_global;
ANALYZE public.personal_best_global;
