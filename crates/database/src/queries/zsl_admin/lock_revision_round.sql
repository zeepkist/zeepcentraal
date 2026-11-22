SELECT r.id
FROM public.zsl_round r JOIN zc_private.zsl_playlist_revision revision ON revision.round_id = r.id
WHERE revision.id = $1 FOR UPDATE OF r
