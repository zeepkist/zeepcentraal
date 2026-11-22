INSERT INTO zc_private.level_submissions(id_contest,workshop_id,authors,state) VALUES($1,$2,$3,'selected') RETURNING id
