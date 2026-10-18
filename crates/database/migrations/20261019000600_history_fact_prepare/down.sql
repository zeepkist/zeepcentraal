SELECT zc_private.rollback_history_fact();
DROP TRIGGER mirror_history_fact ON zc_private.record_history_index;
DROP FUNCTION zc_private.rollback_history_fact();
DROP FUNCTION zc_private.cutover_history_fact(boolean,boolean);
DROP FUNCTION zc_private.verify_history_fact(integer);
DROP FUNCTION zc_private.history_fact_mismatch(integer[]);
DROP FUNCTION zc_private.backfill_history_fact(integer);
DROP FUNCTION zc_private.mirror_history_fact();
DROP TABLE zc_private.history_fact_dirty,zc_private.history_fact_rollout,zc_private.record_history_fact;
