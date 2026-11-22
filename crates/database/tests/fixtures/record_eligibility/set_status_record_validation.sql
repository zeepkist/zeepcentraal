BEGIN; UPDATE zc_private.record_validation SET status='fail' WHERE id_record=1; ROLLBACK
