-- Only explicit recovery may reopen these obsolete, narrowly identified failures.
CREATE FUNCTION zc_private.is_timing_failure(p_status text,p_version text,p_report jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT coalesce(p_status='fail' AND p_version='geometry-8'
  AND jsonb_typeof(p_report->'reasons')='array'
  AND p_report->'reasons'<>'[]'::jsonb
  AND p_report->'reasons' <@ '["event_trajectory_mismatch","invalid_splits"]'::jsonb,false)
$$;
CREATE OR REPLACE FUNCTION zc_private.guard_record_validation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_metadata timestamptz;
BEGIN
 -- Retained failed evidence cannot be replaced, reassigned, or removed.
 IF TG_OP IN ('UPDATE','DELETE') AND OLD.status='fail'
    AND EXISTS(SELECT 1 FROM public.record WHERE id=OLD.id_record) THEN
  IF TG_OP<>'UPDATE' THEN RETURN NULL; END IF;
  IF NOT coalesce(current_setting('zc.timing_recovery',true)='geometry-9'
    AND zc_private.is_timing_failure(OLD.status,OLD.validator_version,OLD.report)
    AND ROW(NEW.id,NEW.id_record,NEW.id_user,NEW.id_level,NEW.ghost_digest,NEW.created_at)
      IS NOT DISTINCT FROM ROW(OLD.id,OLD.id_record,OLD.id_user,OLD.id_level,OLD.ghost_digest,OLD.created_at)
    AND NEW.validator_version='geometry-9'
    AND NEW.report->>'status'=NEW.status
    AND NEW.report->>'validatorVersion'=NEW.validator_version
    AND ((NEW.status='pass' AND NEW.report->'reasons'='[]'::jsonb)
      OR (NEW.status='uncertain' AND NEW.report->'reasons'='["event_trajectory_mismatch"]'::jsonb))
    AND NEW.report->'timingRecovery'=to_jsonb(OLD),false) THEN RETURN NULL; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 SELECT l.validation_metadata_updated_at INTO current_metadata
 FROM public.level l JOIN public.record r ON r.id_level=l.id
 WHERE l.id=NEW.id_level AND r.id=NEW.id_record AND r.id_user=NEW.id_user FOR NO KEY UPDATE OF l;
 -- Evidence describes the snapshot captured before validation, not a later snapshot.
 IF NEW.checked_metadata_at IS DISTINCT FROM current_metadata THEN RETURN NULL; END IF;
 IF TG_OP='UPDATE' AND OLD.status='uncertain'
    AND (NEW.id_record IS DISTINCT FROM OLD.id_record OR NEW.id_level IS DISTINCT FROM OLD.id_level
         OR NEW.checked_metadata_at<=OLD.checked_metadata_at) THEN RETURN NULL; END IF;
 RETURN NEW;
END $$;

-- Compare the complete original row and the downloaded ghost digest. Never clear
-- a failure first: validation and retained history become visible atomically.
CREATE FUNCTION zc_private.recover_timing_failure(
 p_record integer,p_expected jsonb,p_digest text,p_report jsonb,p_checked text,p_metadata text
) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE previous zc_private.record_validation%ROWTYPE; target_level integer;
 current_inputs timestamptz; current_metadata timestamptz; current_record jsonb; current_steam text; current_hash text; changed integer; prior_setting text;
BEGIN
 SELECT l.id,l.validation_inputs_updated_at,l.validation_metadata_updated_at,to_jsonb(r),u.steam_id::text,l.xx_hash
 INTO target_level,current_inputs,current_metadata,current_record,current_steam,current_hash
 FROM public.level l JOIN public.record r ON r.id_level=l.id JOIN public."user" u ON u.id=r.id_user
 WHERE r.id=p_record FOR NO KEY UPDATE OF l,r FOR SHARE OF u;
 IF NOT FOUND OR current_inputs IS DISTINCT FROM p_checked::timestamptz
  OR current_metadata IS DISTINCT FROM p_metadata::timestamptz
  OR current_record IS DISTINCT FROM p_expected->'record'
  OR to_jsonb(current_steam) IS DISTINCT FROM p_expected->'steamId'
  OR to_jsonb(current_hash) IS DISTINCT FROM p_expected->'hash' THEN RETURN false; END IF;
 SELECT * INTO previous FROM zc_private.record_validation WHERE id_record=p_record FOR UPDATE;
 IF NOT FOUND OR to_jsonb(previous) IS DISTINCT FROM p_expected->'validation'
  OR NOT zc_private.is_timing_failure(previous.status,previous.validator_version,previous.report)
  OR previous.id_level<>target_level OR p_digest IS NULL OR previous.ghost_digest IS NULL
  OR previous.ghost_digest IS DISTINCT FROM p_digest
  OR previous.id_user IS DISTINCT FROM (SELECT id_user FROM public.record WHERE id=p_record)
  OR p_report->>'validatorVersion' IS DISTINCT FROM 'geometry-9'
  OR NOT coalesce((p_report->>'status'='pass' AND p_report->'reasons'='[]'::jsonb)
    OR (p_report->>'status'='uncertain' AND p_report->'reasons'='["event_trajectory_mismatch"]'::jsonb),false)
 THEN RETURN false; END IF;
 prior_setting:=current_setting('zc.timing_recovery',true);
 PERFORM set_config('zc.timing_recovery','geometry-9',true);
 UPDATE zc_private.record_validation SET status=p_report->>'status',
  report=p_report || jsonb_build_object('timingRecovery',to_jsonb(previous)),
  validator_version='geometry-9',checked_at=p_checked::timestamptz,
  checked_metadata_at=p_metadata::timestamptz,updated_at=clock_timestamp()
 WHERE id_record=p_record;
 GET DIAGNOSTICS changed=ROW_COUNT;
 PERFORM set_config('zc.timing_recovery',coalesce(prior_setting,''),true);
 IF changed<>1 THEN RETURN false; END IF;
 -- Existing eligibility triggers propagate cached flags; this repair restores projections.
 PERFORM zc_private.schedule_record_eligibility(target_level);
 RETURN true;
END $$;

REVOKE ALL ON FUNCTION zc_private.recover_timing_failure(integer,jsonb,text,jsonb,text,text) FROM PUBLIC;
