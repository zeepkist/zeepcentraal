SELECT c.id FROM zc_private.level_submission_contest c JOIN zc_private.level_submissions s ON s.id_contest=c.id WHERE s.id=$1 AND c.state='open' FOR UPDATE OF c
