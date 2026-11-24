INSERT INTO public.level (hash, xx_hash, publicly_visible) VALUES
    ('track-a', repeat('A', 32), true),
    ('track-b', repeat('B', 32), true),
    ('track-c', repeat('C', 32), true),
    ('track-d', repeat('D', 32), true),
    ('track-e', repeat('E', 32), false);

INSERT INTO public.level_item (id_level, workshop_id, file_uid, image_url)
SELECT level.id, source.workshop_id, source.uid, source.image
FROM (VALUES
    ('track-a', 100, 'warmup-0', 'https://example.test/track-a.jpg'),
    ('track-b', 100, 'warmup-1', ''),
    ('track-b', 200, 'warmup-0', ''),
    ('track-c', 100, 'warmup-2', ''),
    ('track-d', 100, 'warmup-2', ''),
    ('track-e', 100, 'warmup-3', '')
) AS source(hash, workshop_id, uid, image)
JOIN public.level ON level.hash = source.hash;
