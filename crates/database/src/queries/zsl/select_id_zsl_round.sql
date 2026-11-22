SELECT id FROM public.zsl_round r WHERE (id_season=$1 AND round=$2)
    OR EXISTS (SELECT FROM zc_private.zsl_admin_change WHERE entity='round' AND entity_id=r.id
        AND (previous->>'seasonId')::integer=$1 AND (previous->>'number')::integer=$2)
ORDER BY (id_season=$1 AND round=$2) DESC, id LIMIT 1 FOR UPDATE
