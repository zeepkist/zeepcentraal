BEGIN; INSERT INTO zc_private.record_validation(id_record,id_user,id_level,status,report,validator_version) VALUES(2,2,2,'fail','{}','fixture'); ROLLBACK;
