-- Official historical results can predate record uploads. Classify their own time.
CREATE FUNCTION public.zsl_level_result_medal(result public.zsl_level_result) RETURNS smallint
LANGUAGE sql STABLE SET search_path=pg_catalog AS $$
 SELECT zc_private.medal_tier(zc_private.medal_milliseconds(result.time),
  zc_private.medal_milliseconds(item.validation_time_bronze),
  zc_private.medal_milliseconds(item.validation_time_silver),
  zc_private.medal_milliseconds(item.validation_time_gold),
  zc_private.medal_milliseconds(item.validation_time_author),
  zc_private.medal_milliseconds(item.validation_time_expert),
  zc_private.medal_milliseconds(item.validation_time_apex))
 FROM public.zsl_level level
 JOIN public.level_item item ON item.id_level=level.id_level
 WHERE level.id=result.id_level AND NOT item.deleted AND item.publicly_visible
 AND EXISTS(SELECT 1 FROM public."user" player WHERE player.id=result.id_user AND NOT player.banned)
 AND (result.id_record IS NULL OR EXISTS(
  SELECT 1 FROM public.record record WHERE record.id=result.id_record AND record.record_eligible
 ))
 ORDER BY item.updated_at DESC,item.id DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.zsl_level_result_medal(public.zsl_level_result) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.zsl_level_result_medal(public.zsl_level_result) TO zeepcentraal_graphql;
