SET LOCAL lock_timeout = '5s';

-- Keep historical membership and scan state behind the public projection.
CREATE VIEW public.lobby_played_level WITH (security_barrier = true) AS
SELECT membership.lobby_id, membership.level_uid, membership.workshop_id,
       level.xx_hash, item.name, item.image_url,
       coalesce(nullif(item.file_author, ''), author.steam_name) AS author_name
FROM public.lobby_level membership
JOIN public.lobby room ON room.id = membership.lobby_id AND room.is_public
JOIN public.level_item item ON item.id = membership.level_item_id
  AND item.publicly_visible AND NOT item.deleted
JOIN public.level level ON level.id = item.id_level AND level.publicly_visible
LEFT JOIN public."user" author ON author.steam_id = item.author_id;

COMMENT ON VIEW public.lobby_played_level IS E'@primaryKey lobby_id,level_uid,workshop_id\n@behavior -insert -update -delete';
GRANT SELECT ON public.lobby_played_level TO zeepcentraal_graphql;
