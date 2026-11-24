WITH eligible AS (
    SELECT 1
    WHERE NOT EXISTS (
        SELECT 1 FROM zc_private.workshop_scan_request
        WHERE workshop_id = $1 AND last_requested_at > statement_timestamp() - interval '15 minutes'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.level_request WHERE workshop_id = $1
    ) AND NOT EXISTS (
        SELECT 1 FROM zc_jobs.job
        WHERE lane = 'bulk' AND (
            (task = 'scanWorkshopItem' AND payload->>'workshopId' = $1::text)
            OR (task = 'scanWorkshopBatch' AND payload->'workshopIds' ? $1::text)
        )
    )
), gtr_request AS (
    INSERT INTO public.level_request (workshop_id, hash)
    SELECT $1, $2 FROM eligible WHERE $2 IS NOT NULL
    ON CONFLICT (workshop_id) DO NOTHING
    RETURNING id
)
INSERT INTO zc_private.workshop_scan_request (workshop_id, last_requested_at)
SELECT $1, statement_timestamp() FROM eligible
WHERE $2 IS NULL OR EXISTS (SELECT 1 FROM gtr_request)
ON CONFLICT (workshop_id) DO UPDATE SET last_requested_at = EXCLUDED.last_requested_at
