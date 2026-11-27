UPDATE public.lobby_level SET scan_requested_at = now()
WHERE workshop_id = $1 AND level_item_id IS NULL
