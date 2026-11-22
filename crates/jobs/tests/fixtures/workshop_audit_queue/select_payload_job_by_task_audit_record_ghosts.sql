SELECT payload FROM zc_jobs.job WHERE task='auditRecordGhosts' AND NOT running AND jsonb_array_length(payload->'idLevels')<1000
