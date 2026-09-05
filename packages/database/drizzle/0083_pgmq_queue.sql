-- Extension and application-owned runtime schema deliberately remain outside Drizzle's
-- public application model, including GraphQL introspection.
CREATE EXTENSION IF NOT EXISTS pgmq VERSION '1.12.0';
--> statement-breakpoint
CREATE SCHEMA zc_jobs;
--> statement-breakpoint
REVOKE ALL ON SCHEMA zc_jobs FROM PUBLIC;
--> statement-breakpoint
SELECT pgmq.create('zeepcentraal_fast');
--> statement-breakpoint
SELECT pgmq.create('zeepcentraal_bulk');
--> statement-breakpoint
CREATE TABLE zc_jobs.job (
 lane text NOT NULL CHECK (lane IN ('fast', 'bulk')),
 id bigint NOT NULL,
 task text NOT NULL,
 payload jsonb NOT NULL,
 job_key text,
 lock_group text,
 attempts integer NOT NULL DEFAULT 0,
 max_attempts integer NOT NULL CHECK (max_attempts > 0),
 generation bigint NOT NULL DEFAULT 0,
 running boolean NOT NULL DEFAULT false,
 lease_until timestamptz,
 PRIMARY KEY (lane, id)
);
--> statement-breakpoint
CREATE INDEX job_key_idx ON zc_jobs.job(lane, job_key) WHERE job_key IS NOT NULL;
--> statement-breakpoint
CREATE INDEX job_running_idx ON zc_jobs.job(lane, lock_group, lease_until) WHERE running;
--> statement-breakpoint
CREATE TABLE zc_jobs.transfer (
 source_id bigint PRIMARY KEY,
 message_id bigint NOT NULL,
 transferred_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE FUNCTION zc_jobs.lock_lane(p_lane text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF p_lane NOT IN ('fast', 'bulk') THEN RAISE EXCEPTION 'Invalid job lane'; END IF;
 -- All short queue mutations take this lock before touching pgmq or job rows.
 -- No connection/transaction remains held while a handler executes.
 PERFORM pg_advisory_xact_lock(1861284950, CASE p_lane WHEN 'fast' THEN 1 ELSE 2 END);
END $$;
--> statement-breakpoint
CREATE FUNCTION zc_jobs.enqueue(p_lane text, p_task text, p_payload jsonb,
 p_key text DEFAULT NULL, p_group text DEFAULT NULL, p_max integer DEFAULT 3,
 p_run_at timestamptz DEFAULT now()) RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE result bigint;
BEGIN
 PERFORM zc_jobs.lock_lane(p_lane);
 SELECT id INTO result FROM zc_jobs.job
 WHERE lane=p_lane AND job_key=p_key AND NOT running ORDER BY id LIMIT 1;
 IF result IS NOT NULL THEN
  UPDATE zc_jobs.job SET payload=p_payload, max_attempts=p_max
  WHERE lane=p_lane AND id=result;
  RETURN result;
 END IF;
 SELECT pgmq.send('zeepcentraal_' || p_lane, jsonb_build_object('task',p_task),
  GREATEST(0, CEIL(EXTRACT(EPOCH FROM p_run_at-clock_timestamp())))::integer) INTO result;
 INSERT INTO zc_jobs.job(lane,id,task,payload,job_key,lock_group,max_attempts)
 VALUES(p_lane,result,p_task,p_payload,p_key,p_group,p_max);
 RETURN result;
END $$;
--> statement-breakpoint
CREATE FUNCTION zc_jobs.claim(p_lane text, p_count integer, p_vt integer)
RETURNS SETOF zc_jobs.job LANGUAGE plpgsql AS $$
DECLARE claimed zc_jobs.job;
BEGIN
 PERFORM zc_jobs.lock_lane(p_lane);
 IF p_count < 1 OR p_vt < 1 THEN RAISE EXCEPTION 'Invalid claim limits'; END IF;
 -- Pinned pgmq 1.12 queue layout. Filter conflict groups BEFORE limiting candidates;
 -- reading then deferring a bounded prefix can starve work behind a large backlog.
 FOR claimed IN EXECUTE format($query$
  SELECT candidate.* FROM (
   SELECT DISTINCT ON (COALESCE('g:'||j.lock_group,'k:'||j.job_key,'i:'||j.id::text)) j.*
   FROM zc_jobs.job j JOIN pgmq.%I q ON q.msg_id=j.id
   WHERE j.lane=$1 AND q.vt<=clock_timestamp()
   AND NOT EXISTS (
    SELECT 1 FROM zc_jobs.job active WHERE active.lane=j.lane AND active.id<>j.id
    AND active.running AND active.lease_until>clock_timestamp()
    AND ((j.job_key IS NOT NULL AND active.job_key=j.job_key)
      OR (j.lock_group IS NOT NULL AND active.lock_group=j.lock_group))
   )
   ORDER BY COALESCE('g:'||j.lock_group,'k:'||j.job_key,'i:'||j.id::text), j.id
  ) candidate ORDER BY candidate.id LIMIT $2
 $query$, 'q_zeepcentraal_'||p_lane) USING p_lane,p_count LOOP
  -- Also fence keys shared by candidates with different conflict groups.
  IF EXISTS (SELECT 1 FROM zc_jobs.job active WHERE active.lane=p_lane AND active.id<>claimed.id
   AND active.running AND active.lease_until>clock_timestamp()
   AND ((claimed.job_key IS NOT NULL AND active.job_key=claimed.job_key)
    OR (claimed.lock_group IS NOT NULL AND active.lock_group=claimed.lock_group))) THEN CONTINUE; END IF;
  IF claimed.attempts >= claimed.max_attempts THEN
   EXECUTE format('UPDATE pgmq.%I SET message=$1 WHERE msg_id=$2', 'q_zeepcentraal_'||p_lane)
   USING jsonb_build_object('task',claimed.task,'payload',claimed.payload,'jobKey',claimed.job_key,
    'lockGroup',claimed.lock_group,'maxAttempts',claimed.max_attempts,'failure','attempts_exhausted'), claimed.id;
   PERFORM pgmq.archive('zeepcentraal_'||p_lane,claimed.id);
   DELETE FROM zc_jobs.job WHERE lane=p_lane AND id=claimed.id;
   CONTINUE;
  END IF;
  EXECUTE format('UPDATE pgmq.%I SET vt=clock_timestamp()+make_interval(secs=>$1),read_ct=read_ct+1,last_read_at=clock_timestamp() WHERE msg_id=$2', 'q_zeepcentraal_'||p_lane)
   USING p_vt,claimed.id;
  UPDATE zc_jobs.job SET running=true, attempts=attempts+1, generation=generation+1,
   lease_until=clock_timestamp()+make_interval(secs=>p_vt)
  WHERE lane=p_lane AND id=claimed.id RETURNING * INTO claimed;
  RETURN NEXT claimed;
 END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION zc_jobs.heartbeat(p_lane text,p_id bigint,p_generation bigint,p_vt integer)
RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
 PERFORM zc_jobs.lock_lane(p_lane);
 UPDATE zc_jobs.job SET lease_until=clock_timestamp()+make_interval(secs=>p_vt)
 WHERE lane=p_lane AND id=p_id AND generation=p_generation AND running
  AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RETURN false; END IF;
 PERFORM pgmq.set_vt('zeepcentraal_'||p_lane,p_id,p_vt);
 RETURN true;
END $$;
--> statement-breakpoint
CREATE FUNCTION zc_jobs.finish(p_lane text,p_id bigint,p_generation bigint,p_failure text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE current_job zc_jobs.job;
BEGIN
 PERFORM zc_jobs.lock_lane(p_lane);
 SELECT * INTO current_job FROM zc_jobs.job WHERE lane=p_lane AND id=p_id
 AND generation=p_generation AND running AND lease_until>clock_timestamp();
 IF NOT FOUND THEN RETURN false; END IF;
 IF p_failure IS NULL THEN
  PERFORM pgmq.delete('zeepcentraal_'||p_lane,p_id);
  DELETE FROM zc_jobs.job WHERE lane=p_lane AND id=p_id;
 ELSIF current_job.attempts>=current_job.max_attempts OR p_failure='invalid_job' THEN
  EXECUTE format('UPDATE pgmq.%I SET message=$1 WHERE msg_id=$2','q_zeepcentraal_'||p_lane)
  USING jsonb_build_object('task',current_job.task,'payload',current_job.payload,
   'jobKey',current_job.job_key,'lockGroup',current_job.lock_group,'maxAttempts',current_job.max_attempts,
   'failure', CASE WHEN p_failure='invalid_job' THEN 'invalid_job' ELSE 'attempts_exhausted' END),p_id;
  PERFORM pgmq.archive('zeepcentraal_'||p_lane,p_id);
  DELETE FROM zc_jobs.job WHERE lane=p_lane AND id=p_id;
 ELSIF current_job.job_key IS NOT NULL AND EXISTS (
  SELECT 1 FROM zc_jobs.job WHERE lane=p_lane AND job_key=current_job.job_key AND NOT running
 ) THEN
  -- The latest pending request supersedes this failed recalculation.
  PERFORM pgmq.delete('zeepcentraal_'||p_lane,p_id);
  DELETE FROM zc_jobs.job WHERE lane=p_lane AND id=p_id;
 ELSE
  UPDATE zc_jobs.job SET running=false,lease_until=NULL WHERE lane=p_lane AND id=p_id;
  PERFORM pgmq.set_vt('zeepcentraal_'||p_lane,p_id,
   LEAST(300,5*power(2,LEAST(current_job.attempts-1,10)))::integer);
 END IF;
 RETURN true;
END $$;
--> statement-breakpoint
-- Only migration owner may invoke runtime functions by default. Deployment currently
-- uses that owner for jobs/API; separate roles need explicit grants, never PUBLIC.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA zc_jobs FROM PUBLIC;
