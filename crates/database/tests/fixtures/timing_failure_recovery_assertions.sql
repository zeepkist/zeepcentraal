CREATE TRIGGER timing_eligibility_insert AFTER INSERT ON zc_private.record_validation
 REFERENCING NEW TABLE AS new_validations FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_record_validation_eligibility();
CREATE TRIGGER timing_eligibility_update AFTER UPDATE ON zc_private.record_validation
 REFERENCING OLD TABLE AS old_validations NEW TABLE AS new_validations FOR EACH STATEMENT EXECUTE FUNCTION zc_private.tg_record_validation_eligibility();
INSERT INTO zc_private.record_validation(id_record,id_user,id_level,ghost_digest,status,report,validator_version,checked_at,checked_metadata_at)
 VALUES(1,1,1,'fixture-digest','fail','{"status":"fail","reasons":["event_trajectory_mismatch"]}','geometry-8','epoch','epoch'),
 (2,1,1,'fixture-digest','fail','{"status":"fail","reasons":["wrong_steam_id","event_trajectory_mismatch"]}','geometry-8','epoch','epoch'),
 (3,1,1,'fixture-digest','fail','{"status":"fail","reasons":["invalid_splits"]}','geometry-8','epoch','epoch');
DO $$
DECLARE expected jsonb; corrected jsonb:='{"status":"uncertain","reasons":["event_trajectory_mismatch"],"validatorVersion":"geometry-9"}';
BEGIN
 ASSERT NOT (SELECT record_eligible FROM public.record WHERE id=1);
 ASSERT NOT has_function_privilege('timing_recovery_reader','zc_private.recover_timing_failure(integer,jsonb,text,jsonb,text,text)','EXECUTE');
 ASSERT NOT zc_private.is_timing_failure('fail','geometry-8','{"reasons":[]}');
 ASSERT NOT zc_private.is_timing_failure('fail','geometry-9','{"reasons":["invalid_splits"]}');
 ASSERT NOT zc_private.is_timing_failure('fail','geometry-8','{"reasons":["wrong_steam_id","invalid_splits"]}');
 SELECT jsonb_build_object('validation',to_jsonb(v),'record',to_jsonb(r),'steamId',u.steam_id::text,'hash',l.xx_hash)
 INTO expected FROM zc_private.record_validation v JOIN public.record r ON r.id=v.id_record
 JOIN public.level l ON l.id=r.id_level JOIN public."user" u ON u.id=r.id_user WHERE v.id_record=1;
 -- Direct updates/deletes remain blocked, even for otherwise recoverable failures.
 UPDATE zc_private.record_validation SET status='pass' WHERE id_record=1;
 DELETE FROM zc_private.record_validation WHERE id_record=1;
 ASSERT (SELECT status='fail' FROM zc_private.record_validation WHERE id_record=1);
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'wrong-digest',corrected,'epoch','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,expected,NULL,corrected,'epoch','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected,'2026-01-01','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected,'epoch','2026-01-01');
 ASSERT NOT zc_private.recover_timing_failure(1,expected || '{"hash":"wrong"}', 'fixture-digest',corrected,'epoch','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,jsonb_set(expected,'{validation,ghost_digest}','"wrong"'),'fixture-digest',corrected,'epoch','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected || '{"reasons":["missing_snapshot"]}','epoch','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected || '{"status":"fail"}','epoch','epoch');
 UPDATE public.record SET time=10.1 WHERE id=1;
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected,'epoch','epoch');
 UPDATE public.record SET time=10 WHERE id=1;
 -- An exception after recovery rolls back status, flags and queued work together.
 BEGIN
  ASSERT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected,'epoch','epoch');
  RAISE EXCEPTION 'test rollback';
 EXCEPTION WHEN raise_exception THEN NULL;
 END;
 ASSERT (SELECT status='fail' FROM zc_private.record_validation WHERE id_record=1);
 ASSERT NOT (SELECT record_eligible FROM public.record WHERE id=1);
 ASSERT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected,'epoch','epoch');
 ASSERT NOT zc_private.recover_timing_failure(1,expected,'fixture-digest',corrected,'epoch','epoch');
 ASSERT (SELECT report->'timingRecovery'=expected->'validation' FROM zc_private.record_validation WHERE id_record=1);
 ASSERT (SELECT record_eligible FROM public.record WHERE id=1);
 ASSERT (SELECT record_eligible FROM public.record_media WHERE id_record=1);
 ASSERT (SELECT record_count=1 FROM public.level WHERE id=1);
 ASSERT (SELECT count(*)=1 FROM zc_jobs.job WHERE task='reconcileRecordEligibility');
 ASSERT (SELECT status='fail' FROM zc_private.record_validation WHERE id_record=2);
 -- A corrected invalid_splits-only failure can recover to pass.
 SELECT jsonb_build_object('validation',to_jsonb(v),'record',to_jsonb(r),'steamId',u.steam_id::text,'hash',l.xx_hash)
 INTO expected FROM zc_private.record_validation v JOIN public.record r ON r.id=v.id_record
 JOIN public.level l ON l.id=r.id_level JOIN public."user" u ON u.id=r.id_user WHERE v.id_record=3;
 ASSERT zc_private.recover_timing_failure(3,expected,'fixture-digest','{"status":"pass","reasons":[],"validatorVersion":"geometry-9"}','epoch','epoch');
 ASSERT (SELECT record_count=2 FROM public.level WHERE id=1);
END $$;
