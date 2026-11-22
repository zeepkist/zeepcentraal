SELECT id FROM zc_private.level_submissions WHERE id=$1 AND revision=$2 AND state='selected' FOR UPDATE
