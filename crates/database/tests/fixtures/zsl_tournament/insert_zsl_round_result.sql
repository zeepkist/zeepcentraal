INSERT INTO zsl_round_result(id_round,id_user,points,position) SELECT r,$1,r*100,1 FROM generate_series(2,6) r
