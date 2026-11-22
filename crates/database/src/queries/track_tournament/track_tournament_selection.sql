
WITH period_start AS MATERIALIZED (
    SELECT CASE WHEN $1=2
        THEN date_trunc('day', timezone('UTC', $2::text::timestamptz) - interval '6 hours')
        WHEN $1=0 THEN date_trunc('week', timezone('UTC', $2::text::timestamptz) - interval '6 hours')
        ELSE date_trunc('month', timezone('UTC', $2::text::timestamptz) - interval '6 hours')
    END AS utc_start
), period AS (
    SELECT (utc_start AT TIME ZONE 'UTC') + interval '6 hours' AS start_at,
           ((utc_start - CASE WHEN $1=0 THEN interval '84 days' WHEN $1=2 THEN interval '2 months' ELSE interval '6 months' END)
               AT TIME ZONE 'UTC') + interval '6 hours' AS window_start_at,
           ((utc_start + CASE WHEN $1=0 THEN interval '1 week' WHEN $1=2 THEN interval '1 day' ELSE interval '1 month' END)
               AT TIME ZONE 'UTC') + interval '6 hours' AS end_at,
           CASE WHEN $1=0 THEN to_char(utc_start, 'IYYY-"w"IW')
                WHEN $1=2 THEN to_char(utc_start, 'YYYY-MM-DD')
                ELSE to_char(utc_start, 'YYYY-MM') END AS slug
    FROM period_start
), available AS MATERIALIZED (
    SELECT points.id_level, points.points, level.date_created
    FROM public.level_points points
    JOIN public.level level ON level.id=points.id_level AND level.publicly_visible=true
    CROSS JOIN period
    WHERE level.date_created < period.start_at
      AND points.points > 0
      AND EXISTS (
          SELECT 1 FROM public.level_item item
          WHERE item.id_level=level.id AND item.publicly_visible=true AND item.deleted=false
      )
      AND NOT EXISTS (
          SELECT 1 FROM public.track_tournament used
          WHERE used.type=$1 AND used.id_level=level.id
      )
), eligible AS MATERIALIZED (
    SELECT available.* FROM available CROSS JOIN period
    WHERE ($1=2 AND extract(day FROM period.start_at AT TIME ZONE 'UTC')::integer % 2=0)
      OR available.date_created >= period.window_start_at
      OR NOT EXISTS (SELECT 1 FROM available recent WHERE recent.date_created >= period.window_start_at)
), threshold AS (
    SELECT percentile_cont(CASE $1 WHEN 0 THEN 0.99 WHEN 1 THEN 0.999 ELSE 0.95 END)
        WITHIN GROUP (ORDER BY points) AS points
    FROM eligible
), selected AS (
    SELECT eligible.id_level
    FROM eligible CROSS JOIN threshold
    WHERE eligible.points >= threshold.points
    ORDER BY random()
    LIMIT 1
)
INSERT INTO public.track_tournament
    (type, slug, id_level, start_at, end_at, points_version, date_created, date_updated)
SELECT $1, period.slug, selected.id_level, period.start_at, period.end_at,
       1, $2::text::timestamptz, $2::text::timestamptz
FROM selected CROSS JOIN period
RETURNING id
