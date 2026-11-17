ALTER TABLE zc_jobs.job ADD COLUMN traceparent text, ADD COLUMN tracestate text;

-- No payload or SQL function signature changes. Old producers remain valid.
CREATE FUNCTION zc_jobs.capture_trace_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'INSERT' OR (NOT OLD.running AND NOT NEW.running) THEN
  NEW.traceparent := NULLIF(current_setting('zc.traceparent', true), '');
  NEW.tracestate := NULLIF(current_setting('zc.tracestate', true), '');
  IF length(NEW.traceparent) > 512 THEN NEW.traceparent := NULL; END IF;
  IF length(NEW.tracestate) > 512 THEN NEW.tracestate := NULL; END IF;
 END IF;
 RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION zc_jobs.capture_trace_context() FROM PUBLIC;

CREATE TRIGGER capture_trace_context BEFORE INSERT OR UPDATE OF payload ON zc_jobs.job
FOR EACH ROW EXECUTE FUNCTION zc_jobs.capture_trace_context();
