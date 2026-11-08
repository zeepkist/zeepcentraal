SET LOCAL lock_timeout = '5s';

-- Resolve the exact active Adventure alias, not an arbitrary workshop upload.
CREATE FUNCTION public.adventure_level_membership_level_item(membership public.adventure_level_membership)
RETURNS public.level_item LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT i.* FROM public.level_item i
 WHERE i.id_level=membership.id_level AND NOT i.deleted
  AND lower(split_part(i.name,'-',1))=membership.series
  AND i.name ~* '^[A-Z]+-[0-9]+$'
  AND EXISTS(SELECT 1 FROM public.adventure_level_membership m
   WHERE m.series=membership.series AND m.id_level=membership.id_level)
 ORDER BY i.updated_at DESC,i.id DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.adventure_level_membership_level_item(public.adventure_level_membership) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adventure_level_membership_level_item(public.adventure_level_membership) TO zeepcentraal_graphql;
