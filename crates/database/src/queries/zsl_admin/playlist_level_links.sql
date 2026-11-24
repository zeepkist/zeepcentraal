SELECT level.xx_hash, thumbnail.image_url
FROM jsonb_to_recordset($1) AS input(position integer, workshop_id bigint, uid text, canonical_hash text)
LEFT JOIN LATERAL (
    SELECT min(item.id_level) AS id_level
    FROM public.level_item item
    WHERE input.canonical_hash IS NULL
      AND item.workshop_id = input.workshop_id AND item.file_uid = input.uid
      AND NOT item.deleted
    HAVING count(DISTINCT item.id_level) = 1 AND bool_or(item.publicly_visible)
) exact ON true
LEFT JOIN public.level level ON level.publicly_visible AND level.xx_hash <> '' AND (
    (input.canonical_hash IS NOT NULL AND level.xx_hash = upper(input.canonical_hash))
    OR level.id = exact.id_level
)
LEFT JOIN LATERAL (
    SELECT item.image_url
    FROM public.level_item item
    WHERE item.id_level = level.id AND NOT item.deleted AND item.publicly_visible
      AND item.workshop_id = input.workshop_id AND item.file_uid = input.uid
      AND item.image_url <> ''
    ORDER BY item.id DESC
    LIMIT 1
) thumbnail ON true
ORDER BY input.position
