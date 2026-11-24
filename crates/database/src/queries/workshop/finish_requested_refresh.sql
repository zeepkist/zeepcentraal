UPDATE zc_private.workshop_scan_request
SET reconcile_pending = false, last_scanned_updated_at = $2::timestamptz
WHERE workshop_id = $1
