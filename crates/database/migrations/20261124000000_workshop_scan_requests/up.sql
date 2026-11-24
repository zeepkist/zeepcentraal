CREATE TABLE zc_private.workshop_scan_request (
    workshop_id bigint PRIMARY KEY CHECK (workshop_id > 0),
    last_requested_at timestamptz NOT NULL,
    last_scanned_updated_at timestamptz,
    reconcile_pending boolean NOT NULL DEFAULT false
);
