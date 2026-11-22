SELECT id FROM zc_private.level_submissions WHERE id_contest=$1 AND $2=ANY(authors) AND state IN ('selected','withdrawn') ORDER BY (state='selected') DESC,date_updated DESC LIMIT 1
