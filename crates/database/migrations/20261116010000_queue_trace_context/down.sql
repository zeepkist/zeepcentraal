DROP TRIGGER capture_trace_context ON zc_jobs.job;
DROP FUNCTION zc_jobs.capture_trace_context();
ALTER TABLE zc_jobs.job DROP COLUMN tracestate, DROP COLUMN traceparent;
