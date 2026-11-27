SELECT workshop_id
FROM public.lobby_level
WHERE level_item_id IS NULL AND workshop_id > 0
  AND (scan_requested_at IS NULL OR scan_requested_at < now() - interval '1 day')
GROUP BY workshop_id
ORDER BY min(scan_requested_at) NULLS FIRST, workshop_id
LIMIT 100
