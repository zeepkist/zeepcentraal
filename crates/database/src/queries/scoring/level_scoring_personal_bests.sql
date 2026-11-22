WITH ranked AS MATERIALIZED (
 SELECT pb.id_level, run.id, run.time,
        count(*) OVER (PARTITION BY pb.id_level) AS total_count,
        row_number() OVER (PARTITION BY pb.id_level ORDER BY run.time, run.id) AS row_number
 FROM public.personal_best_global pb
 JOIN public.record run ON run.id = pb.id_record
 JOIN public."user" account ON account.id = pb.id_user
 WHERE pb.id_level = ANY($1) AND pb.record_eligible AND run.record_eligible AND NOT account.banned
)
SELECT ranked.id_level, ranked.total_count, ranked.time, detail.splits,
       statistic.time AS statistic_time, statistic.turn_left_count, statistic.turn_left_time,
       statistic.turn_right_count, statistic.turn_right_time, statistic.brake_count,
       statistic.brake_time, statistic.arms_up_count, statistic.arms_up_time,
       statistic.driver_input_transition_count, statistic.has_input_data
FROM ranked
JOIN public.record detail ON detail.id = ranked.id
LEFT JOIN public.record_statistic statistic ON statistic.id_record = ranked.id
WHERE ranked.row_number <= 20
ORDER BY ranked.id_level, ranked.row_number
