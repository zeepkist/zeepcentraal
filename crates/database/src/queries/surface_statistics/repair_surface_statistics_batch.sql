
            WITH candidates AS MATERIALIZED (
                SELECT id_record FROM public.record_statistic
                WHERE id_record<=$1 AND ($2::integer IS NULL OR id_record<$2)
                  AND {{missing_surface_totals}}
                ORDER BY id_record DESC LIMIT $3
            ), repaired AS (
                UPDATE public.record_statistic statistic SET
                    distance_on_unknown=CASE WHEN distance_on_unknown IS NULL AND distance_on_ground IS NOT NULL THEN
                        GREATEST(0::double precision, distance_on_ground::double precision -
                            (COALESCE(distance_on_tarmac,0)::double precision + COALESCE(distance_on_grass,0)::double precision +
                             COALESCE(distance_on_sand,0)::double precision + COALESCE(distance_on_soap,0)::double precision +
                             COALESCE(distance_on_wood,0)::double precision + COALESCE(distance_on_mud,0)::double precision +
                             COALESCE(distance_on_ice1,0)::double precision + COALESCE(distance_on_ice2,0)::double precision +
                             COALESCE(distance_on_ice3,0)::double precision))::real
                        ELSE distance_on_unknown END,
                    time_on_unknown=CASE WHEN time_on_unknown IS NULL AND time_on_ground IS NOT NULL THEN
                        GREATEST(0::double precision, time_on_ground::double precision -
                            (COALESCE(time_on_tarmac,0)::double precision + COALESCE(time_on_grass,0)::double precision +
                             COALESCE(time_on_sand,0)::double precision + COALESCE(time_on_soap,0)::double precision +
                             COALESCE(time_on_wood,0)::double precision + COALESCE(time_on_mud,0)::double precision +
                             COALESCE(time_on_ice1,0)::double precision + COALESCE(time_on_ice2,0)::double precision +
                             COALESCE(time_on_ice3,0)::double precision))::real
                        ELSE time_on_unknown END,
                    date_updated=clock_timestamp()
                FROM candidates WHERE statistic.id_record=candidates.id_record
                  AND ((statistic.distance_on_unknown IS NULL AND statistic.distance_on_ground IS NOT NULL)
                    OR (statistic.time_on_unknown IS NULL AND statistic.time_on_ground IS NOT NULL))
                RETURNING statistic.id_record
            )
            SELECT count(*) AS processed,
                (SELECT min(id_record) FROM candidates) AS before_id FROM repaired
