SELECT c.id FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE c.id=$1 AND r.submission_start<=clock_timestamp() AND clock_timestamp()<r.submission_end
