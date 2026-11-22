
CREATE FUNCTION pg_temp.capture_metrics(at_time timestamptz) RETURNS void LANGUAGE plpgsql AS $$
DECLARE snapshot public.global_metric_summary;
BEGIN
 snapshot := zc_private.compute_global_metrics(at_time);
 DELETE FROM public.statistics;
 INSERT INTO public.statistics SELECT true,3,snapshot.*;
END $$;
