UPDATE zc_private.record_validation SET report=report || jsonb_build_object('status',status,'validatorVersion',validator_version);
