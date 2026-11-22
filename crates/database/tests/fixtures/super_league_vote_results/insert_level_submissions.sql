INSERT INTO zc_private.level_submissions(id_contest,workshop_id,authors,state,level_hash) VALUES($1,$2,$3,'selected',$4) RETURNING id
