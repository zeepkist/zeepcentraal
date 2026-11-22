SELECT id,id_points_structure FROM public.zsl_season s
WHERE name=$1 OR EXISTS (SELECT FROM zc_private.zsl_admin_change
    WHERE entity='season' AND entity_id=s.id AND previous->>'name'=$1)
ORDER BY (name=$1) DESC, id LIMIT 1 FOR UPDATE
