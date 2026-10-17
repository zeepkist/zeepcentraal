CREATE OR REPLACE FUNCTION zc_jobs.claim(p_lane text, p_count integer, p_vt integer)
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
