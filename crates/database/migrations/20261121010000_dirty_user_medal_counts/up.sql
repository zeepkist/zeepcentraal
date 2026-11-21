CREATE TABLE zc_private.user_medal_count_dirty (
 id_user integer PRIMARY KEY REFERENCES public."user"(id) ON DELETE CASCADE,
 revision bigint GENERATED ALWAYS AS IDENTITY NOT NULL
);
REVOKE ALL ON TABLE zc_private.user_medal_count_dirty FROM PUBLIC;

-- Sort IDs before upsert so overlapping statements acquire marker locks in the same order.
CREATE FUNCTION zc_private.mark_user_medal_counts_dirty(users integer[]) RETURNS void
LANGUAGE sql SET search_path=pg_catalog AS $$
 INSERT INTO zc_private.user_medal_count_dirty(id_user)
 SELECT DISTINCT u.id FROM unnest(users) target(id) JOIN public."user" u USING(id)
 ORDER BY u.id
 ON CONFLICT(id_user) DO UPDATE SET revision=DEFAULT
$$;

CREATE FUNCTION zc_private.mark_level_medal_counts_dirty(levels integer[]) RETURNS void
LANGUAGE sql SET search_path=pg_catalog AS $$
 SELECT zc_private.mark_user_medal_counts_dirty(ARRAY(
  SELECT DISTINCT pb.id_user FROM public.personal_best_global pb WHERE pb.id_level=ANY(levels)
 ))
$$;

CREATE FUNCTION zc_private.tg_dirty_pb_medal_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM zc_private.mark_user_medal_counts_dirty(ARRAY(SELECT id_user FROM new_medal_inputs));
 ELSIF TG_OP='DELETE' THEN
  PERFORM zc_private.mark_user_medal_counts_dirty(ARRAY(SELECT id_user FROM old_medal_inputs));
 ELSE
  PERFORM zc_private.mark_user_medal_counts_dirty(ARRAY(
   SELECT id_user FROM (
    (SELECT id_user,id_level,record_eligible,medal FROM new_medal_inputs
     EXCEPT SELECT id_user,id_level,record_eligible,medal FROM old_medal_inputs)
    UNION ALL
    (SELECT id_user,id_level,record_eligible,medal FROM old_medal_inputs
     EXCEPT SELECT id_user,id_level,record_eligible,medal FROM new_medal_inputs)
   ) changes
  ));
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION zc_private.tg_dirty_item_medal_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  PERFORM zc_private.mark_level_medal_counts_dirty(ARRAY(
   SELECT DISTINCT id_level FROM new_medal_inputs WHERE publicly_visible AND NOT deleted
  ));
 ELSIF TG_OP='DELETE' THEN
  PERFORM zc_private.mark_level_medal_counts_dirty(ARRAY(
   SELECT DISTINCT id_level FROM old_medal_inputs WHERE publicly_visible AND NOT deleted
  ));
 ELSE
  PERFORM zc_private.mark_level_medal_counts_dirty(ARRAY(
   (SELECT id_level FROM new_medal_inputs WHERE publicly_visible AND NOT deleted
    EXCEPT SELECT id_level FROM old_medal_inputs WHERE publicly_visible AND NOT deleted)
   UNION ALL
   (SELECT id_level FROM old_medal_inputs WHERE publicly_visible AND NOT deleted
    EXCEPT SELECT id_level FROM new_medal_inputs WHERE publicly_visible AND NOT deleted)
  ));
 END IF;
 RETURN NULL;
END $$;

CREATE FUNCTION zc_private.tg_dirty_account_or_level_medal_counts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_NAME='user' THEN
  PERFORM zc_private.mark_user_medal_counts_dirty(ARRAY[NEW.id]);
 ELSE
  PERFORM zc_private.mark_level_medal_counts_dirty(ARRAY[NEW.id]);
 END IF;
 RETURN NULL;
END $$;

CREATE TRIGGER dirty_pb_medal_counts_insert AFTER INSERT ON public.personal_best_global
 REFERENCING NEW TABLE AS new_medal_inputs FOR EACH STATEMENT
 EXECUTE FUNCTION zc_private.tg_dirty_pb_medal_counts();
CREATE TRIGGER dirty_pb_medal_counts_delete AFTER DELETE ON public.personal_best_global
 REFERENCING OLD TABLE AS old_medal_inputs FOR EACH STATEMENT
 EXECUTE FUNCTION zc_private.tg_dirty_pb_medal_counts();
CREATE TRIGGER dirty_pb_medal_counts_update AFTER UPDATE ON public.personal_best_global
 REFERENCING OLD TABLE AS old_medal_inputs NEW TABLE AS new_medal_inputs FOR EACH STATEMENT
 EXECUTE FUNCTION zc_private.tg_dirty_pb_medal_counts();

CREATE TRIGGER dirty_item_medal_counts_insert AFTER INSERT ON public.level_item
 REFERENCING NEW TABLE AS new_medal_inputs FOR EACH STATEMENT
 EXECUTE FUNCTION zc_private.tg_dirty_item_medal_counts();
CREATE TRIGGER dirty_item_medal_counts_delete AFTER DELETE ON public.level_item
 REFERENCING OLD TABLE AS old_medal_inputs FOR EACH STATEMENT
 EXECUTE FUNCTION zc_private.tg_dirty_item_medal_counts();
CREATE TRIGGER dirty_item_medal_counts_update AFTER UPDATE ON public.level_item
 REFERENCING OLD TABLE AS old_medal_inputs NEW TABLE AS new_medal_inputs FOR EACH STATEMENT
 EXECUTE FUNCTION zc_private.tg_dirty_item_medal_counts();

CREATE TRIGGER dirty_account_medal_counts AFTER UPDATE OF banned ON public."user"
 FOR EACH ROW WHEN (OLD.banned IS DISTINCT FROM NEW.banned)
 EXECUTE FUNCTION zc_private.tg_dirty_account_or_level_medal_counts();
CREATE TRIGGER dirty_level_medal_counts AFTER UPDATE OF publicly_visible ON public.level
 FOR EACH ROW WHEN (OLD.publicly_visible IS DISTINCT FROM NEW.publicly_visible)
 EXECUTE FUNCTION zc_private.tg_dirty_account_or_level_medal_counts();

-- Score locks serialize refreshes for a user. The revision prevents acknowledging
-- changes committed after the refresh read its markers.
CREATE FUNCTION zc_private.refresh_dirty_user_medal_counts(users integer[]) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog AS $$
DECLARE dirty_users integer[]; revisions bigint[];
BEGIN
 SELECT array_agg(id_user ORDER BY id_user),array_agg(revision ORDER BY id_user)
 INTO dirty_users,revisions FROM zc_private.user_medal_count_dirty WHERE id_user=ANY(users);
 IF dirty_users IS NULL THEN RETURN; END IF;

 INSERT INTO public.user_points(id_user,medal_apex,medal_expert,medal_author,medal_gold,medal_silver,medal_bronze,medal_none,date_updated)
 SELECT id_user,apex,expert,author,gold,silver,bronze,"none",clock_timestamp()
 FROM zc_private.user_medal_counts(dirty_users)
 ON CONFLICT(id_user) DO UPDATE SET medal_apex=excluded.medal_apex,medal_expert=excluded.medal_expert,
  medal_author=excluded.medal_author,medal_gold=excluded.medal_gold,medal_silver=excluded.medal_silver,
  medal_bronze=excluded.medal_bronze,medal_none=excluded.medal_none,date_updated=excluded.date_updated
 WHERE ROW(user_points.medal_apex,user_points.medal_expert,user_points.medal_author,user_points.medal_gold,
           user_points.medal_silver,user_points.medal_bronze,user_points.medal_none)
 IS DISTINCT FROM ROW(excluded.medal_apex,excluded.medal_expert,excluded.medal_author,excluded.medal_gold,
                      excluded.medal_silver,excluded.medal_bronze,excluded.medal_none);

 DELETE FROM zc_private.user_medal_count_dirty marker
 USING unnest(dirty_users,revisions) counted(id_user,revision)
 WHERE marker.id_user=counted.id_user AND marker.revision=counted.revision;
END $$;

REVOKE ALL ON FUNCTION zc_private.mark_user_medal_counts_dirty(integer[]),
 zc_private.mark_level_medal_counts_dirty(integer[]),zc_private.tg_dirty_pb_medal_counts(),
 zc_private.tg_dirty_item_medal_counts(),zc_private.tg_dirty_account_or_level_medal_counts(),
 zc_private.refresh_dirty_user_medal_counts(integer[]) FROM PUBLIC;

INSERT INTO zc_private.user_medal_count_dirty(id_user) SELECT id FROM public."user" ORDER BY id;
