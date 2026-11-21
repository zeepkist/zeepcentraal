CREATE FUNCTION public.profile_telemetry_summary(profile_user_id integer, day_since timestamptz, month_since timestamptz, year_since timestamptz) RETURNS text
LANGUAGE sql STABLE STRICT SECURITY INVOKER SET search_path = pg_catalog AS $$
 SELECT jsonb_build_object(
  'allStatistics', jsonb_build_object(
   'totalCount', count(*),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance), 0)
    )
   )
  ),
  'dayStatistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE r.date_created >= day_since),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE r.date_created >= day_since), 0)
    )
   )
  ),
  'monthStatistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE r.date_created >= month_since),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE r.date_created >= month_since), 0)
    )
   )
  ),
  'yearStatistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE r.date_created >= year_since),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE r.date_created >= year_since), 0)
    )
   )
  ),
  'v6Statistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE s.ghost_version >= 6),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceInAir', coalesce(sum(s.distance_in_air) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOn1Wheel', coalesce(sum(s.distance_on_1_wheel) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOn2Wheels', coalesce(sum(s.distance_on_2_wheels) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOn3Wheels', coalesce(sum(s.distance_on_3_wheels) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOn4Wheels', coalesce(sum(s.distance_on_4_wheels) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnGrass', coalesce(sum(s.distance_on_grass) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnGround', coalesce(sum(s.distance_on_ground) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnIce1', coalesce(sum(s.distance_on_ice1) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnIce2', coalesce(sum(s.distance_on_ice2) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnIce3', coalesce(sum(s.distance_on_ice3) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnWood', coalesce(sum(s.distance_on_wood) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnMud', coalesce(sum(s.distance_on_mud) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnUnknown', coalesce(sum(s.distance_on_unknown) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnSand', coalesce(sum(s.distance_on_sand) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnSoap', coalesce(sum(s.distance_on_soap) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceOnTarmac', coalesce(sum(s.distance_on_tarmac) FILTER (WHERE s.ghost_version >= 6), 0),
     'distanceRagdoll', coalesce(sum(s.distance_ragdoll) FILTER (WHERE s.ghost_version >= 6), 0),
     'time', coalesce(sum(s.time) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeInAir', coalesce(sum(s.time_in_air) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnGrass', coalesce(sum(s.time_on_grass) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnGround', coalesce(sum(s.time_on_ground) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnIce1', coalesce(sum(s.time_on_ice1) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnIce2', coalesce(sum(s.time_on_ice2) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnIce3', coalesce(sum(s.time_on_ice3) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnWood', coalesce(sum(s.time_on_wood) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnMud', coalesce(sum(s.time_on_mud) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnUnknown', coalesce(sum(s.time_on_unknown) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnSand', coalesce(sum(s.time_on_sand) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnSoap', coalesce(sum(s.time_on_soap) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeOnTarmac', coalesce(sum(s.time_on_tarmac) FILTER (WHERE s.ghost_version >= 6), 0),
     'timeRagdoll', coalesce(sum(s.time_ragdoll) FILTER (WHERE s.ghost_version >= 6), 0),
     'turnLeftCount', coalesce(sum(s.turn_left_count) FILTER (WHERE s.ghost_version >= 6), 0)::text,
     'turnRightCount', coalesce(sum(s.turn_right_count) FILTER (WHERE s.ghost_version >= 6), 0)::text,
     'armsUpCount', coalesce(sum(s.arms_up_count) FILTER (WHERE s.ghost_version >= 6), 0)::text,
     'brakeCount', coalesce(sum(s.brake_count) FILTER (WHERE s.ghost_version >= 6), 0)::text,
     'hornCount', coalesce(sum(s.horn_count) FILTER (WHERE s.ghost_version >= 6), 0)::text
    ),
    'average', jsonb_build_object(
     'averageGforce', avg(s.average_gforce) FILTER (WHERE s.ghost_version >= 6),
     'averageSpeed', avg(s.average_speed) FILTER (WHERE s.ghost_version >= 6)
    ),
    'max', jsonb_build_object(
     'maxGforce', max(s.max_gforce) FILTER (WHERE s.ghost_version >= 6),
     'maxSpeed', max(s.max_speed) FILTER (WHERE s.ghost_version >= 6)
    )
   )
  ),
  'v6DayStatistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceInAir', coalesce(sum(s.distance_in_air) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOn1Wheel', coalesce(sum(s.distance_on_1_wheel) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOn2Wheels', coalesce(sum(s.distance_on_2_wheels) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOn3Wheels', coalesce(sum(s.distance_on_3_wheels) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOn4Wheels', coalesce(sum(s.distance_on_4_wheels) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnGrass', coalesce(sum(s.distance_on_grass) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnGround', coalesce(sum(s.distance_on_ground) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnIce1', coalesce(sum(s.distance_on_ice1) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnIce2', coalesce(sum(s.distance_on_ice2) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnIce3', coalesce(sum(s.distance_on_ice3) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnWood', coalesce(sum(s.distance_on_wood) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnMud', coalesce(sum(s.distance_on_mud) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnUnknown', coalesce(sum(s.distance_on_unknown) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnSand', coalesce(sum(s.distance_on_sand) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnSoap', coalesce(sum(s.distance_on_soap) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceOnTarmac', coalesce(sum(s.distance_on_tarmac) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'distanceRagdoll', coalesce(sum(s.distance_ragdoll) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'time', coalesce(sum(s.time) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeInAir', coalesce(sum(s.time_in_air) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnGrass', coalesce(sum(s.time_on_grass) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnGround', coalesce(sum(s.time_on_ground) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnIce1', coalesce(sum(s.time_on_ice1) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnIce2', coalesce(sum(s.time_on_ice2) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnIce3', coalesce(sum(s.time_on_ice3) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnWood', coalesce(sum(s.time_on_wood) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnMud', coalesce(sum(s.time_on_mud) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnUnknown', coalesce(sum(s.time_on_unknown) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnSand', coalesce(sum(s.time_on_sand) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnSoap', coalesce(sum(s.time_on_soap) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeOnTarmac', coalesce(sum(s.time_on_tarmac) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'timeRagdoll', coalesce(sum(s.time_ragdoll) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0),
     'turnLeftCount', coalesce(sum(s.turn_left_count) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0)::text,
     'turnRightCount', coalesce(sum(s.turn_right_count) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0)::text,
     'armsUpCount', coalesce(sum(s.arms_up_count) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0)::text,
     'brakeCount', coalesce(sum(s.brake_count) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0)::text,
     'hornCount', coalesce(sum(s.horn_count) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6), 0)::text
    ),
    'average', jsonb_build_object(
     'averageGforce', avg(s.average_gforce) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6),
     'averageSpeed', avg(s.average_speed) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6)
    ),
    'max', jsonb_build_object(
     'maxGforce', max(s.max_gforce) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6),
     'maxSpeed', max(s.max_speed) FILTER (WHERE r.date_created >= day_since AND s.ghost_version >= 6)
    )
   )
  ),
  'v6MonthStatistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceInAir', coalesce(sum(s.distance_in_air) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOn1Wheel', coalesce(sum(s.distance_on_1_wheel) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOn2Wheels', coalesce(sum(s.distance_on_2_wheels) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOn3Wheels', coalesce(sum(s.distance_on_3_wheels) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOn4Wheels', coalesce(sum(s.distance_on_4_wheels) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnGrass', coalesce(sum(s.distance_on_grass) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnGround', coalesce(sum(s.distance_on_ground) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnIce1', coalesce(sum(s.distance_on_ice1) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnIce2', coalesce(sum(s.distance_on_ice2) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnIce3', coalesce(sum(s.distance_on_ice3) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnWood', coalesce(sum(s.distance_on_wood) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnMud', coalesce(sum(s.distance_on_mud) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnUnknown', coalesce(sum(s.distance_on_unknown) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnSand', coalesce(sum(s.distance_on_sand) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnSoap', coalesce(sum(s.distance_on_soap) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceOnTarmac', coalesce(sum(s.distance_on_tarmac) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'distanceRagdoll', coalesce(sum(s.distance_ragdoll) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'time', coalesce(sum(s.time) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeInAir', coalesce(sum(s.time_in_air) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnGrass', coalesce(sum(s.time_on_grass) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnGround', coalesce(sum(s.time_on_ground) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnIce1', coalesce(sum(s.time_on_ice1) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnIce2', coalesce(sum(s.time_on_ice2) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnIce3', coalesce(sum(s.time_on_ice3) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnWood', coalesce(sum(s.time_on_wood) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnMud', coalesce(sum(s.time_on_mud) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnUnknown', coalesce(sum(s.time_on_unknown) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnSand', coalesce(sum(s.time_on_sand) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnSoap', coalesce(sum(s.time_on_soap) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeOnTarmac', coalesce(sum(s.time_on_tarmac) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'timeRagdoll', coalesce(sum(s.time_ragdoll) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0),
     'turnLeftCount', coalesce(sum(s.turn_left_count) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0)::text,
     'turnRightCount', coalesce(sum(s.turn_right_count) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0)::text,
     'armsUpCount', coalesce(sum(s.arms_up_count) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0)::text,
     'brakeCount', coalesce(sum(s.brake_count) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0)::text,
     'hornCount', coalesce(sum(s.horn_count) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6), 0)::text
    ),
    'average', jsonb_build_object(
     'averageGforce', avg(s.average_gforce) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6),
     'averageSpeed', avg(s.average_speed) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6)
    ),
    'max', jsonb_build_object(
     'maxGforce', max(s.max_gforce) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6),
     'maxSpeed', max(s.max_speed) FILTER (WHERE r.date_created >= month_since AND s.ghost_version >= 6)
    )
   )
  ),
  'v6YearStatistics', jsonb_build_object(
   'totalCount', count(*) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6),
   'aggregates', jsonb_build_object(
    'sum', jsonb_build_object(
     'distance', coalesce(sum(s.distance) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceInAir', coalesce(sum(s.distance_in_air) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOn1Wheel', coalesce(sum(s.distance_on_1_wheel) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOn2Wheels', coalesce(sum(s.distance_on_2_wheels) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOn3Wheels', coalesce(sum(s.distance_on_3_wheels) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOn4Wheels', coalesce(sum(s.distance_on_4_wheels) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnGrass', coalesce(sum(s.distance_on_grass) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnGround', coalesce(sum(s.distance_on_ground) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnIce1', coalesce(sum(s.distance_on_ice1) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnIce2', coalesce(sum(s.distance_on_ice2) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnIce3', coalesce(sum(s.distance_on_ice3) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnWood', coalesce(sum(s.distance_on_wood) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnMud', coalesce(sum(s.distance_on_mud) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnUnknown', coalesce(sum(s.distance_on_unknown) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnSand', coalesce(sum(s.distance_on_sand) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnSoap', coalesce(sum(s.distance_on_soap) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceOnTarmac', coalesce(sum(s.distance_on_tarmac) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'distanceRagdoll', coalesce(sum(s.distance_ragdoll) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'time', coalesce(sum(s.time) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeInAir', coalesce(sum(s.time_in_air) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnGrass', coalesce(sum(s.time_on_grass) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnGround', coalesce(sum(s.time_on_ground) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnIce1', coalesce(sum(s.time_on_ice1) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnIce2', coalesce(sum(s.time_on_ice2) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnIce3', coalesce(sum(s.time_on_ice3) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnWood', coalesce(sum(s.time_on_wood) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnMud', coalesce(sum(s.time_on_mud) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnUnknown', coalesce(sum(s.time_on_unknown) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnSand', coalesce(sum(s.time_on_sand) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnSoap', coalesce(sum(s.time_on_soap) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeOnTarmac', coalesce(sum(s.time_on_tarmac) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'timeRagdoll', coalesce(sum(s.time_ragdoll) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0),
     'turnLeftCount', coalesce(sum(s.turn_left_count) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0)::text,
     'turnRightCount', coalesce(sum(s.turn_right_count) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0)::text,
     'armsUpCount', coalesce(sum(s.arms_up_count) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0)::text,
     'brakeCount', coalesce(sum(s.brake_count) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0)::text,
     'hornCount', coalesce(sum(s.horn_count) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6), 0)::text
    ),
    'average', jsonb_build_object(
     'averageGforce', avg(s.average_gforce) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6),
     'averageSpeed', avg(s.average_speed) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6)
    ),
    'max', jsonb_build_object(
     'maxGforce', max(s.max_gforce) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6),
     'maxSpeed', max(s.max_speed) FILTER (WHERE r.date_created >= year_since AND s.ghost_version >= 6)
    )
   )
  )
 )::text
 FROM public.record r
 JOIN public.record_statistic s ON s.id_record = r.id
 WHERE r.id_user = profile_user_id
$$;

REVOKE ALL ON FUNCTION public.profile_telemetry_summary(integer,timestamptz,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_telemetry_summary(integer,timestamptz,timestamptz,timestamptz) TO zeepcentraal_graphql;
