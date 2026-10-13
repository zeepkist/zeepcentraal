CREATE INDEX CONCURRENTLY IF NOT EXISTS record_validation_failed_record_idx
 ON zc_private.record_validation(id_record) WHERE status='fail';
