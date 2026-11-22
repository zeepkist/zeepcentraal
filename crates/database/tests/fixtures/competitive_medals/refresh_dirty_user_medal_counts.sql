
        SELECT zc_private.refresh_dirty_user_medal_counts(ARRAY(SELECT id FROM public."user"));
        UPDATE public.user_points SET medal_apex=999 WHERE id_user=2;
        SELECT zc_private.refresh_dirty_user_medal_counts(ARRAY[2]);
        DO $$ BEGIN
          ASSERT (SELECT medal_apex=999 FROM public.user_points WHERE id_user=2);
        END $$;

        UPDATE public."user" SET banned=false WHERE id=2;
        CREATE FUNCTION zc_private.remark_during_test_refresh() RETURNS trigger
        LANGUAGE plpgsql AS $$ BEGIN
          PERFORM zc_private.mark_user_medal_counts_dirty(ARRAY[NEW.id_user]);
          RETURN NULL;
        END $$;
        CREATE TRIGGER remark_during_test_refresh AFTER UPDATE ON public.user_points
        FOR EACH ROW EXECUTE FUNCTION zc_private.remark_during_test_refresh();
        SELECT zc_private.refresh_dirty_user_medal_counts(ARRAY[2]);
        DO $$ BEGIN
          ASSERT EXISTS(SELECT 1 FROM zc_private.user_medal_count_dirty WHERE id_user=2);
        END $$;
        DROP TRIGGER remark_during_test_refresh ON public.user_points;
        DROP FUNCTION zc_private.remark_during_test_refresh();
        SELECT zc_private.refresh_dirty_user_medal_counts(ARRAY[2]);
        DO $$ BEGIN
          ASSERT NOT EXISTS(SELECT 1 FROM zc_private.user_medal_count_dirty WHERE id_user=2);
          ASSERT (SELECT p.medal_apex=m.apex AND p.medal_expert=m.expert
                  FROM public.user_points p JOIN zc_private.user_medal_counts(ARRAY[2]) m USING(id_user));
        END $$;

        UPDATE public.level SET publicly_visible=false WHERE id=1;
        SELECT zc_private.refresh_dirty_user_medal_counts(ARRAY[2]);
        UPDATE public.level_item SET deleted=false WHERE id_level=2;
        DO $$ BEGIN
          ASSERT EXISTS(SELECT 1 FROM zc_private.user_medal_count_dirty WHERE id_user=2);
        END $$;
