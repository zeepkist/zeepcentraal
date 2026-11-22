SELECT id FROM zc_private.level_submission_contest WHERE id_zsl_round=$1 AND state='open' AND rules_hash<>$2 FOR UPDATE
