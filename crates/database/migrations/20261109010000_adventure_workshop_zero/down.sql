SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

UPDATE public.level_item AS item
SET workshop_id = -1
FROM public.level AS level
WHERE item.id_level = level.id AND level.adventure
  AND item.author_id = 76561198041027402 AND item.workshop_id = 0;

-- Keep the zero parent: other mappings may now reference it.
