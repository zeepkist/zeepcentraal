WITH resolved AS (
    SELECT mapping.lobby_id, mapping.level_uid, mapping.workshop_id, item.id AS level_item_id
    FROM public.lobby_level mapping
    LEFT JOIN LATERAL (
        SELECT item.id FROM public.level_item item
        WHERE item.workshop_id = mapping.workshop_id AND item.file_uid = mapping.level_uid
          AND NOT item.deleted
        ORDER BY item.updated_at DESC, item.id DESC LIMIT 1
    ) item ON true
    WHERE mapping.workshop_id = $1
)
UPDATE public.lobby_level mapping SET level_item_id = resolved.level_item_id
FROM resolved
WHERE (mapping.lobby_id, mapping.level_uid, mapping.workshop_id) =
      (resolved.lobby_id, resolved.level_uid, resolved.workshop_id)
  AND mapping.level_item_id IS DISTINCT FROM resolved.level_item_id
