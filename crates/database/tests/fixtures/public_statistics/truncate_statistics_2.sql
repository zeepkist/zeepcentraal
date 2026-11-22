TRUNCATE public.statistics; INSERT INTO public.statistics SELECT true,3,m.* FROM zc_private.compute_global_metrics('2026-10-19Z') m
