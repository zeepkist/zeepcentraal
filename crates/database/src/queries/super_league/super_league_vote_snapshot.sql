SELECT id_level AS level_id,vote_type FROM zc_private.level_submission_vote WHERE id_contest=$1 AND id_user=$2 ORDER BY vote_type,id_level
