ALTER TABLE public.user_points ADD COLUMN personal_bests integer NOT NULL DEFAULT 0;

-- One item proves availability. Extra uploads must not multiply record counts.
CREATE FUNCTION zc_private.user_record_counts(p_users integer[])
RETURNS TABLE(id_user integer, personal_bests integer, world_records integer)
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT target.id,
   (SELECT count(*)::integer FROM public.personal_best_global pb
    WHERE pb.id_user=target.id
      AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation invalid
        WHERE invalid.id_record=pb.id_record AND invalid.status='fail')
      AND EXISTS(SELECT 1 FROM public.level_item item
        WHERE item.id_level=pb.id_level AND item.deleted=false)),
   (SELECT count(*)::integer FROM public.world_record_global wr
    WHERE wr.id_user=target.id
      AND NOT EXISTS(SELECT 1 FROM zc_private.record_validation invalid
        WHERE invalid.id_record=wr.id_record AND invalid.status='fail')
      AND EXISTS(SELECT 1 FROM public.level_item item
        WHERE item.id_level=wr.id_level AND item.deleted=false))
 FROM (SELECT DISTINCT unnest(p_users) AS id) target
 JOIN public."user" account ON account.id=target.id ORDER BY target.id
$$;
REVOKE ALL ON FUNCTION zc_private.user_record_counts(integer[]) FROM PUBLIC;

-- Include old cached holders so unavailable records reset to zero.
INSERT INTO public.user_points(id_user,personal_bests,world_records,date_updated)
SELECT id_user,personal_bests,world_records,clock_timestamp()
FROM zc_private.user_record_counts(ARRAY(
 SELECT id_user FROM public.user_points
 UNION SELECT id_user FROM public.personal_best_global
 UNION SELECT id_user FROM public.world_record_global
))
ON CONFLICT(id_user) DO UPDATE SET personal_bests=excluded.personal_bests,
 world_records=excluded.world_records,date_updated=excluded.date_updated
WHERE ROW(user_points.personal_bests,user_points.world_records)
 IS DISTINCT FROM ROW(excluded.personal_bests,excluded.world_records);

-- Queue writes commit with projection writes, without taking user score locks.
CREATE FUNCTION zc_private.tg_user_record_count_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target integer;
BEGIN
 IF TG_OP='INSERT' THEN
  FOR target IN SELECT DISTINCT id_user FROM new_counts ORDER BY id_user LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),
    'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 ELSIF TG_OP='DELETE' THEN
  FOR target IN SELECT DISTINCT previous.id_user FROM old_counts previous
   JOIN public."user" account ON account.id=previous.id_user ORDER BY previous.id_user LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),
    'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 ELSE
  FOR target IN
   SELECT id_user FROM (
    SELECT id_user,id_level,id_record FROM old_counts
    EXCEPT SELECT id_user,id_level,id_record FROM new_counts
   ) removed
   UNION SELECT id_user FROM (
    SELECT id_user,id_level,id_record FROM new_counts
    EXCEPT SELECT id_user,id_level,id_record FROM old_counts
   ) added ORDER BY id_user
  LOOP
   PERFORM zc_jobs.enqueue('bulk','updatePlayerScore',jsonb_build_object('idUser',target),
    'update-player-score:'||target,'global-scores',3,clock_timestamp());
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION zc_private.tg_user_record_count_refresh() FROM PUBLIC;

CREATE TRIGGER pb_count_insert AFTER INSERT ON public.personal_best_global
 REFERENCING NEW TABLE AS new_counts FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_user_record_count_refresh();
CREATE TRIGGER pb_count_update AFTER UPDATE ON public.personal_best_global
 REFERENCING OLD TABLE AS old_counts NEW TABLE AS new_counts FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_user_record_count_refresh();
CREATE TRIGGER pb_count_delete AFTER DELETE ON public.personal_best_global
 REFERENCING OLD TABLE AS old_counts FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_user_record_count_refresh();
CREATE TRIGGER wr_count_insert AFTER INSERT ON public.world_record_global
 REFERENCING NEW TABLE AS new_counts FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_user_record_count_refresh();
CREATE TRIGGER wr_count_update AFTER UPDATE ON public.world_record_global
 REFERENCING OLD TABLE AS old_counts NEW TABLE AS new_counts FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_user_record_count_refresh();
CREATE TRIGGER wr_count_delete AFTER DELETE ON public.world_record_global
 REFERENCING OLD TABLE AS old_counts FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_user_record_count_refresh();

-- Coalesce batch scans by level. Recount touched levels even when another
-- upload survives: concurrent removals must never miss the final deletion.
CREATE FUNCTION zc_private.tg_level_record_count_refresh() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE target integer;
BEGIN
 IF TG_OP='INSERT' THEN
  FOR target IN SELECT DISTINCT id_level FROM new_items WHERE NOT deleted ORDER BY id_level LOOP
   PERFORM zc_jobs.enqueue('bulk','updateLevelRecordCounts',jsonb_build_object('idLevel',target,'afterUserId',0),
    'update-level-record-counts:'||target||':0','level-record-counts:'||target,3,clock_timestamp());
  END LOOP;
 ELSIF TG_OP='DELETE' THEN
  FOR target IN SELECT DISTINCT previous.id_level FROM old_items previous JOIN public.level level ON level.id=previous.id_level
   WHERE NOT previous.deleted ORDER BY previous.id_level LOOP
   PERFORM zc_jobs.enqueue('bulk','updateLevelRecordCounts',jsonb_build_object('idLevel',target,'afterUserId',0),
    'update-level-record-counts:'||target||':0','level-record-counts:'||target,3,clock_timestamp());
  END LOOP;
 ELSE
  FOR target IN SELECT previous.id_level FROM old_items previous JOIN new_items current USING(id)
   WHERE ROW(previous.id_level,previous.deleted) IS DISTINCT FROM ROW(current.id_level,current.deleted)
   UNION SELECT current.id_level FROM old_items previous JOIN new_items current USING(id)
   WHERE ROW(previous.id_level,previous.deleted) IS DISTINCT FROM ROW(current.id_level,current.deleted)
   ORDER BY id_level
  LOOP
   PERFORM zc_jobs.enqueue('bulk','updateLevelRecordCounts',jsonb_build_object('idLevel',target,'afterUserId',0),
    'update-level-record-counts:'||target||':0','level-record-counts:'||target,3,clock_timestamp());
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION zc_private.tg_level_record_count_refresh() FROM PUBLIC;
CREATE TRIGGER level_count_insert AFTER INSERT ON public.level_item
 REFERENCING NEW TABLE AS new_items FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_level_record_count_refresh();
CREATE TRIGGER level_count_update AFTER UPDATE ON public.level_item
 REFERENCING OLD TABLE AS old_items NEW TABLE AS new_items FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_level_record_count_refresh();
CREATE TRIGGER level_count_delete AFTER DELETE ON public.level_item
 REFERENCING OLD TABLE AS old_items FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_level_record_count_refresh();
