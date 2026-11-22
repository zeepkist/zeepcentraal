UPDATE public.zsl_round SET submission_end=now()-interval '1 second' WHERE id=$1
