SELECT id FROM zc_private.level_submissions WHERE id_contest=$1 AND state='selected' AND ($2 IS NULL OR id<>$2) AND (authors && $3 OR workshop_id=$4) LIMIT 1
