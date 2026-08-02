WITH ranked_personal_bests AS (
	SELECT
		personal_best.id_user,
		personal_best.id_level,
		personal_best.id_record,
		level_score.points AS level_points,
		(
			RANK() OVER (
				PARTITION BY personal_best.id_level
				ORDER BY personal_best_record.time
			)
		)::integer AS level_position
	FROM public.personal_best_global AS personal_best
	INNER JOIN public.record AS personal_best_record
		ON personal_best_record.id = personal_best.id_record
	INNER JOIN public.level_points AS level_score
		ON level_score.id_level = personal_best.id_level
	WHERE level_score.points > 0
), level_contributions AS (
	SELECT
		ranked_personal_bests.*,
		CASE
			WHEN LN(ranked_personal_bests.level_points::double precision)
				+ (ranked_personal_bests.level_position - 1)
					* LN(0.985::double precision)
				< LN(1.401298464324817e-45::double precision)
				THEN 0::double precision
			ELSE ranked_personal_bests.level_points::double precision * POWER(
				0.985::double precision,
				ranked_personal_bests.level_position - 1
			)
		END AS level_decayed_points
	FROM ranked_personal_bests
), ranked_player_contributions AS (
	SELECT
		level_contributions.*,
		(
			ROW_NUMBER() OVER (
				PARTITION BY level_contributions.id_user
				ORDER BY
					level_contributions.level_decayed_points DESC,
					level_contributions.id_level,
					level_contributions.id_record
			)
		)::integer AS contribution_rank
	FROM level_contributions
), desired AS (
	SELECT
		ranked_player_contributions.*,
		CASE
			WHEN ranked_player_contributions.level_decayed_points
				< 1.401298464324817e-45::double precision
				THEN 0::double precision
			WHEN LN(ranked_player_contributions.level_decayed_points)
				+ (ranked_player_contributions.contribution_rank - 1)
					* LN(0.95::double precision)
				< LN(1.401298464324817e-45::double precision)
				THEN 0::double precision
			ELSE ranked_player_contributions.level_decayed_points * POWER(
				0.95::double precision,
				ranked_player_contributions.contribution_rank - 1
			)
		END AS player_decayed_points
	FROM ranked_player_contributions
)
INSERT INTO public.user_point_contribution (
	id_user,
	id_level,
	id_record,
	contribution_rank,
	level_position,
	level_points,
	level_decayed_points,
	player_decayed_points,
	date_calculated
)
SELECT
	desired.id_user,
	desired.id_level,
	desired.id_record,
	desired.contribution_rank,
	desired.level_position,
	desired.level_points,
	desired.level_decayed_points,
	desired.player_decayed_points,
	NOW()
FROM desired
ON CONFLICT (id_user, id_level) DO UPDATE SET
	id_record = EXCLUDED.id_record,
	contribution_rank = EXCLUDED.contribution_rank,
	level_position = EXCLUDED.level_position,
	level_points = EXCLUDED.level_points,
	level_decayed_points = EXCLUDED.level_decayed_points,
	player_decayed_points = EXCLUDED.player_decayed_points,
	date_calculated = EXCLUDED.date_calculated
WHERE ROW(
	user_point_contribution.id_record,
	user_point_contribution.contribution_rank,
	user_point_contribution.level_position,
	user_point_contribution.level_points,
	user_point_contribution.level_decayed_points,
	user_point_contribution.player_decayed_points
) IS DISTINCT FROM ROW(
	EXCLUDED.id_record,
	EXCLUDED.contribution_rank,
	EXCLUDED.level_position,
	EXCLUDED.level_points,
	EXCLUDED.level_decayed_points,
	EXCLUDED.player_decayed_points
);--> statement-breakpoint
DELETE FROM public.user_point_contribution AS contribution
WHERE NOT EXISTS (
	SELECT 1
	FROM public.personal_best_global AS personal_best
	INNER JOIN public.level_points AS level_score
		ON level_score.id_level = personal_best.id_level
	WHERE personal_best.id_user = contribution.id_user
		AND personal_best.id_level = contribution.id_level
		AND personal_best.id_record = contribution.id_record
		AND level_score.points > 0
);
