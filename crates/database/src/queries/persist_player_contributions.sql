WITH source AS MATERIALIZED (
 SELECT * FROM jsonb_to_recordset($2::jsonb) AS value(
 id_level integer,id_record integer,level_position bigint,level_points integer,
 level_decayed_points real,contribution_rank integer,player_decayed_points real)
), expected AS (
 SELECT id_level,id_record,level_position,level_points,level_decayed_points FROM source
), current AS MATERIALIZED (
 SELECT id_level,id_record,level_position::bigint,level_points,level_decayed_points
 FROM public.user_point_contribution WHERE id_user=$1
), validated AS MATERIALIZED (
 SELECT NOT EXISTS((SELECT * FROM expected EXCEPT SELECT * FROM current)
  UNION ALL (SELECT * FROM current EXCEPT SELECT * FROM expected)) AS value
), updated AS (
 UPDATE public.user_point_contribution target SET contribution_rank=source.contribution_rank,
 player_decayed_points=source.player_decayed_points,date_calculated=clock_timestamp()
 FROM source CROSS JOIN validated
 WHERE validated.value AND target.id_user=$1 AND target.id_level=source.id_level
 AND ROW(target.id_record,target.level_position,target.level_points,target.level_decayed_points)
 IS NOT DISTINCT FROM ROW(source.id_record,source.level_position,source.level_points,source.level_decayed_points)
 AND ROW(target.contribution_rank,target.player_decayed_points)
 IS DISTINCT FROM ROW(source.contribution_rank,source.player_decayed_points)
)
SELECT value FROM validated
