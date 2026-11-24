UPDATE zc_private.workshop_scan_request request
SET reconcile_pending = true
WHERE request.workshop_id = $1 AND (
    request.reconcile_pending OR $2::timestamptz > COALESCE(GREATEST(
        request.last_scanned_updated_at,
        (SELECT updated_at FROM public.workshop_item WHERE workshop_id = $1)
    ), '-infinity'::timestamptz) OR EXISTS (
        SELECT 1 FROM public.workshop_item
        WHERE workshop_id = $1 AND visibility <> $3
    ) OR (
        request.last_scanned_updated_at IS NULL AND NOT EXISTS (
            SELECT 1 FROM public.level_item WHERE workshop_id = $1 AND NOT deleted
        )
    )
)
