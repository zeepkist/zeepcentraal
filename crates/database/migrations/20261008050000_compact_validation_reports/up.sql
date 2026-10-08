UPDATE zc_private.record_validation SET report=report-'status'-'validatorVersion'-'validator_version' WHERE report ?| ARRAY['status','validatorVersion','validator_version'];
