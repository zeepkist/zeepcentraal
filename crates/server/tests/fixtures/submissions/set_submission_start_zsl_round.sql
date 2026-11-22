UPDATE public.zsl_round SET submission_start=now()-interval '4 days',submission_end=now()-interval '3 days',zsl_vote_end=now()-interval '2 days',cosmetic_vote_end=now()-interval '1 day' WHERE id=9000
