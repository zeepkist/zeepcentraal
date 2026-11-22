
        UPDATE public.user_points SET rank=-1 WHERE id_user<=201;
        CREATE TABLE zc_private.score_test_mutation(applied boolean NOT NULL);
        INSERT INTO zc_private.score_test_mutation VALUES(false);
        CREATE FUNCTION zc_private.score_test_change_points() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
          IF NEW.id_user=51 AND EXISTS(SELECT FROM zc_private.score_test_mutation WHERE NOT applied) THEN
            UPDATE zc_private.score_test_mutation SET applied=true;
            UPDATE public.user_points SET points=0 WHERE id_user=1;
          END IF;
          RETURN NEW;
        END $$;
        CREATE TRIGGER score_test_change_points AFTER UPDATE OF rank ON public.user_points
          FOR EACH ROW EXECUTE FUNCTION zc_private.score_test_change_points();
