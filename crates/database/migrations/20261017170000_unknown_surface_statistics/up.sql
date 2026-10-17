-- Nullable columns avoid rewriting historical rows during deployment.
ALTER TABLE public.record_statistic
    ADD COLUMN distance_on_unknown real,
    ADD COLUMN time_on_unknown real;
