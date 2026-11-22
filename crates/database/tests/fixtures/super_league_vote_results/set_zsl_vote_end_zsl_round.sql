UPDATE public.zsl_round SET zsl_vote_end=clock_timestamp() WHERE id=$1
