import { sql } from 'drizzle-orm'
import { type DatabaseExecutor, db } from '../client'
import { playerSkillAggregate } from '../schema'

const MINIMUM_SKILL_LEVEL_FIELD = 20
const MINIMUM_OTHER_SKILL_LEVELS = 20
const SKILL_PRIOR_COUNT = 10
const SKILL_PRIOR_SUM = SKILL_PRIOR_COUNT * 0.5

export interface LevelSkillMetrics {
	alignment: number | null
	fieldStrength: number | null
	ratedPlayerCount: number
	separation: number | null
}

interface LevelSkillMetricsRow extends LevelSkillMetrics, Record<string, unknown> {
	idLevel: number
}

/** Rebuilds independent player skill using only raw, current PB placements. */
export async function rebuildPlayerSkillAggregates(): Promise<number> {
	return db.transaction(async (tx) => {
		await tx.delete(playerSkillAggregate)
		const result = await tx.execute(sql`
			WITH ranked_personal_bests AS MATERIALIZED (
				SELECT
					personal_best.id_user,
					RANK() OVER (
						PARTITION BY personal_best.id_level
						ORDER BY personal_best_record.time
					) AS placement_rank,
					COUNT(*) OVER (PARTITION BY personal_best.id_level) AS field_count
				FROM personal_best_global AS personal_best
				INNER JOIN record AS personal_best_record
					ON personal_best_record.id = personal_best.id_record
				INNER JOIN "user" AS personal_best_user
					ON personal_best_user.id = personal_best.id_user
				WHERE personal_best_user.banned = false
					AND personal_best_record.time > 0
			),
			eligible_placements AS (
				SELECT
					id_user,
					1 - (placement_rank - 1)::double precision / (field_count - 1) AS placement
				FROM ranked_personal_bests
				WHERE field_count >= ${MINIMUM_SKILL_LEVEL_FIELD}
			),
			player_placements AS (
				SELECT
					id_user,
					SUM(placement)::double precision AS placement_sum,
					COUNT(*)::integer AS eligible_level_count
				FROM eligible_placements
				GROUP BY id_user
			)
			INSERT INTO player_skill_aggregate (
				id_user,
				placement_sum,
				eligible_level_count,
				skill,
				date_updated
			)
			SELECT
				id_user,
				placement_sum,
				eligible_level_count,
				(${SKILL_PRIOR_SUM} + placement_sum) /
					(${SKILL_PRIOR_COUNT} + eligible_level_count),
				NOW()
			FROM player_placements
			RETURNING id_user
		`)
		return result.length
	})
}

export async function getLevelSkillMetricsByLevelIds(
	idLevels: number[],
	executor: DatabaseExecutor = db,
): Promise<Map<number, LevelSkillMetrics>> {
	if (idLevels.length === 0) return new Map()
	const levelIdList = sql.join(
		idLevels.map((idLevel) => sql`${idLevel}`),
		sql`, `,
	)
	const rows = await executor.execute<LevelSkillMetricsRow>(sql`
		WITH target_ranked AS MATERIALIZED (
			SELECT
				personal_best.id_level,
				personal_best.id_user,
				personal_best_record.time,
				MIN(personal_best_record.time) OVER (
					PARTITION BY personal_best.id_level
				) AS world_record_time,
				RANK() OVER (
					PARTITION BY personal_best.id_level
					ORDER BY personal_best_record.time
				) AS placement_rank,
				COUNT(*) OVER (PARTITION BY personal_best.id_level) AS field_count
			FROM personal_best_global AS personal_best
			INNER JOIN record AS personal_best_record
				ON personal_best_record.id = personal_best.id_record
			INNER JOIN "user" AS personal_best_user
				ON personal_best_user.id = personal_best.id_user
			WHERE personal_best.id_level IN (${levelIdList})
				AND personal_best_user.banned = false
				AND personal_best_record.time > 0
		),
		target_placements AS MATERIALIZED (
			SELECT
				*,
				CASE
					WHEN field_count > 1 THEN
						1 - (placement_rank - 1)::double precision / (field_count - 1)
					ELSE 0.5
				END AS placement,
				CASE WHEN field_count >= ${MINIMUM_SKILL_LEVEL_FIELD} THEN 1 ELSE 0 END
					AS target_contributed
			FROM target_ranked
		),
		leave_one_out AS MATERIALIZED (
			SELECT
				target.*,
				(
					${SKILL_PRIOR_SUM} + aggregate.placement_sum -
						target.placement * target.target_contributed
				) / (
					${SKILL_PRIOR_COUNT} + aggregate.eligible_level_count -
						target.target_contributed
				) AS independent_skill
			FROM target_placements AS target
			INNER JOIN player_skill_aggregate AS aggregate
				ON aggregate.id_user = target.id_user
			WHERE aggregate.eligible_level_count - target.target_contributed >=
				${MINIMUM_OTHER_SKILL_LEVELS}
		),
		skill_ranked AS MATERIALIZED (
			SELECT
				*,
				PERCENT_RANK() OVER (
					PARTITION BY id_level
					ORDER BY independent_skill
				) AS skill_percentile
			FROM leave_one_out
		)
		SELECT
			id_level AS "idLevel",
			COUNT(*)::integer AS "ratedPlayerCount",
			CORR(skill_percentile, placement)::double precision AS alignment,
			(
				PERCENTILE_CONT(0.5) WITHIN GROUP (
					ORDER BY LN(time / world_record_time)
				) FILTER (WHERE skill_percentile BETWEEN 0.4 AND 0.6)
				-
				PERCENTILE_CONT(0.5) WITHIN GROUP (
					ORDER BY LN(time / world_record_time)
				) FILTER (WHERE skill_percentile >= 0.8)
			)::double precision AS separation,
			PERCENTILE_CONT(0.5) WITHIN GROUP (
				ORDER BY independent_skill
			) FILTER (WHERE placement_rank <= 10)::double precision AS "fieldStrength"
		FROM skill_ranked
		GROUP BY id_level
	`)

	return new Map(
		rows.map((row) => [
			row.idLevel,
			{
				alignment: row.alignment,
				fieldStrength: row.fieldStrength,
				ratedPlayerCount: row.ratedPlayerCount,
				separation: row.separation,
			},
		]),
	)
}
