SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

-- Preserve the legacy parent for rollback and any unrelated references.
INSERT INTO public.workshop_item (
    workshop_id, author_id, name, image_url, visibility, publicly_visible, file_size,
    created_at, updated_at, date_created, date_updated
)
SELECT 0, author_id, name, image_url, visibility, publicly_visible, file_size,
       created_at, updated_at, date_created, date_updated
FROM public.workshop_item WHERE workshop_id = -1
ON CONFLICT (workshop_id) DO NOTHING;

-- Only official built-in aliases change. Workshop uploads of Adventure maps retain their IDs.
UPDATE public.level_item AS item
SET workshop_id = 0
FROM public.level AS level
WHERE item.id_level = level.id AND level.adventure
  AND item.author_id = 76561198041027402 AND item.workshop_id = -1;
