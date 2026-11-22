SELECT c.id FROM zc_private.level_submission_contest c JOIN public.zsl_round r ON r.id=c.id_zsl_round WHERE r.id=$1 AND c.state='open' FOR UPDATE OF c
