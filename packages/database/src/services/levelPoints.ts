import { eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { levelPoints, levelPointsHistory } from '../schema'
import { sanitizeLevelPointRealValues } from './levelPointRealValues'

const unavailableLevelPointMetrics = {
	sampleSize: null,
	leaderboardConfidence: null,
	inputSampleSize: null,
	inputCoverage: null,
	airSampleSize: null,
	wheelSampleSize: null,
	slipSampleSize: null,
	ragdollSampleSize: null,
	stateSampleSize: null,
	surfaceSampleSize: null,
	velocitySampleSize: null,
	competitivenessScore: null,
	worldRecordDifficultyScore: null,
	participationScore: null,
	passivePlaySeverity: null,
	modifierAfk: null,
	passiveRunRatio: null,
	passiveTop10Share: null,
	bestPassiveRank: null,
	bestPassiveGap: null,
	driverEngagementScore: null,
	worldRecordMargin: null,
	top5Spread: null,
	top10Spread: null,
	top50Spread: null,
	wrChallengerCount: null,
	worldRecordOptimizationScore: null,
	leaderboardAnomalyScore: null,
	telemetryAnomalyScore: null,
	worldRecordExcluded: null,
	pathConsistencyScore: null,
	speedConsistencyScore: null,
	routeConsistencyScore: null,
	surfaceDiversityScore: null,
	matureVoteCount: null,
	typicalDistance: null,
	typicalAverageSpeed: null,
	typicalMaxSpeed: null,
	typicalAirTimeShare: null,
	typicalGroundTimeShare: null,
	typicalSlipShare: null,
	typicalRagdollShare: null,
	typicalAverageAngularVelocity: null,
	typicalAverageGforce: null,
	medianSteeringShare: null,
	q25SteeringShare: null,
	lowSteeringRatio: null,
	zeroControlRatio: null,
	medianBrakeShare: null,
	medianArmsUpShare: null,
	medianControlTransitionRate: null,
} satisfies Partial<typeof levelPoints.$inferInsert>

const zeroLevelPointValues = {
	points: 0,
	lengthModifier: 0,
	competitivenessModifier: 0,
	ratingModifier: 1,
	popularityModifier: 0.75,
	cutPenalty: 1,
	...unavailableLevelPointMetrics,
} satisfies Partial<typeof levelPoints.$inferInsert>

export async function getTotalLevelPoints() {
	const totalPoints = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(levelPoints)
		.then((rows) => Number(rows[0]?.count))

	return totalPoints ?? 0
}

export async function getChangedLevelPointsPaginated(offset: number, limit: number) {
	const latestHistory = db
		.select({ ...getTableColumns(levelPointsHistory) })
		.from(levelPointsHistory)
		.where(sql`
			(${levelPointsHistory.idLevel}, ${levelPointsHistory.dateCreated}) IN (
				SELECT ${levelPointsHistory.idLevel}, MAX(${levelPointsHistory.dateCreated})
				FROM ${levelPointsHistory}
				GROUP BY ${levelPointsHistory.idLevel}
			)
		`)
		.as('latest_history')

	return db
		.select({ ...getTableColumns(levelPoints) })
		.from(levelPoints)
		.innerJoin(latestHistory, eq(levelPoints.idLevel, latestHistory.idLevel))
		.where(sql<boolean>`
			(to_jsonb(${levelPoints}) - 'id_level' - 'date_created' - 'date_updated')
			IS DISTINCT FROM
			(to_jsonb(${latestHistory}) - 'id' - 'id_level' - 'date_created' - 'date_updated')
		`)
		.offset(offset)
		.limit(limit)
}

export async function getChangedLevelPointIds(): Promise<number[]> {
	const latestHistory = db
		.select({ ...getTableColumns(levelPointsHistory) })
		.from(levelPointsHistory)
		.where(sql`
			(${levelPointsHistory.idLevel}, ${levelPointsHistory.dateCreated}) IN (
				SELECT ${levelPointsHistory.idLevel}, MAX(${levelPointsHistory.dateCreated})
				FROM ${levelPointsHistory}
				GROUP BY ${levelPointsHistory.idLevel}
			)
		`)
		.as('latest_history')

	const rows = await db
		.select({ idLevel: levelPoints.idLevel })
		.from(levelPoints)
		.leftJoin(latestHistory, eq(levelPoints.idLevel, latestHistory.idLevel))
		.where(
			sql<boolean>`
				${latestHistory.idLevel} IS NULL
				OR (
					(to_jsonb(${levelPoints}) - 'id_level' - 'date_created' - 'date_updated')
					IS DISTINCT FROM
					(to_jsonb(${latestHistory}) - 'id' - 'id_level' - 'date_created' - 'date_updated')
				)
			`,
		)
		.orderBy(levelPoints.idLevel)
	return rows.map((row) => row.idLevel)
}

export async function getLevelPointsByIds(ids: number[]) {
	if (ids.length === 0) {
		return []
	}
	return db
		.select({ ...getTableColumns(levelPoints) })
		.from(levelPoints)
		.where(inArray(levelPoints.idLevel, ids))
}

export type UpdateLevelPointsPayload = Omit<
	typeof levelPoints.$inferInsert,
	'dateCreated' | 'dateUpdated'
>

export async function upsertLevelPointsBulk(payloads: UpdateLevelPointsPayload[]): Promise<void> {
	if (payloads.length === 0) {
		return
	}

	const dateUpdated = new Date().toISOString()
	await db
		.insert(levelPoints)
		.values(
			payloads.map((payload) => sanitizeLevelPointRealValues({ ...payload, dateUpdated })),
		)
		.onConflictDoUpdate({
			target: levelPoints.idLevel,
			set: {
				points: sql`excluded.points`,
				rating: sql`excluded.rating`,
				lengthModifier: sql`excluded.modifier_length`,
				competitivenessModifier: sql`excluded.modifier_competitiveness`,
				ratingModifier: sql`excluded.modifier_rating`,
				popularityModifier: sql`excluded.modifier_popularity`,
				cutPenalty: sql`excluded.cut_penalty`,
				sampleSize: sql`excluded.sample_size`,
				leaderboardConfidence: sql`excluded.leaderboard_confidence`,
				inputSampleSize: sql`excluded.input_sample_size`,
				inputCoverage: sql`excluded.input_coverage`,
				airSampleSize: sql`excluded.air_sample_size`,
				wheelSampleSize: sql`excluded.wheel_sample_size`,
				slipSampleSize: sql`excluded.slip_sample_size`,
				ragdollSampleSize: sql`excluded.ragdoll_sample_size`,
				stateSampleSize: sql`excluded.state_sample_size`,
				surfaceSampleSize: sql`excluded.surface_sample_size`,
				velocitySampleSize: sql`excluded.velocity_sample_size`,
				competitivenessScore: sql`excluded.competitiveness_score`,
				worldRecordDifficultyScore: sql`excluded.world_record_difficulty_score`,
				participationScore: sql`excluded.participation_score`,
				passivePlaySeverity: sql`excluded.passive_play_severity`,
				modifierAfk: sql`excluded.modifier_afk`,
				passiveRunRatio: sql`excluded.passive_run_ratio`,
				passiveTop10Share: sql`excluded.passive_top_10_share`,
				bestPassiveRank: sql`excluded.best_passive_rank`,
				bestPassiveGap: sql`excluded.best_passive_gap`,
				driverEngagementScore: sql`excluded.driver_engagement_score`,
				worldRecordMargin: sql`excluded.world_record_margin`,
				top5Spread: sql`excluded.top_5_spread`,
				top10Spread: sql`excluded.top_10_spread`,
				top50Spread: sql`excluded.top_50_spread`,
				wrChallengerCount: sql`excluded.wr_challenger_count`,
				worldRecordOptimizationScore: sql`excluded.world_record_optimization_score`,
				leaderboardAnomalyScore: sql`excluded.leaderboard_anomaly_score`,
				telemetryAnomalyScore: sql`excluded.telemetry_anomaly_score`,
				worldRecordExcluded: sql`excluded.world_record_excluded`,
				pathConsistencyScore: sql`excluded.path_consistency_score`,
				speedConsistencyScore: sql`excluded.speed_consistency_score`,
				routeConsistencyScore: sql`excluded.route_consistency_score`,
				surfaceDiversityScore: sql`excluded.surface_diversity_score`,
				matureVoteCount: sql`excluded.mature_vote_count`,
				typicalDistance: sql`excluded.typical_distance`,
				typicalAverageSpeed: sql`excluded.typical_average_speed`,
				typicalMaxSpeed: sql`excluded.typical_max_speed`,
				typicalAirTimeShare: sql`excluded.typical_air_time_share`,
				typicalGroundTimeShare: sql`excluded.typical_ground_time_share`,
				typicalSlipShare: sql`excluded.typical_slip_share`,
				typicalRagdollShare: sql`excluded.typical_ragdoll_share`,
				typicalAverageAngularVelocity: sql`excluded.typical_average_angular_velocity`,
				typicalAverageGforce: sql`excluded.typical_average_gforce`,
				medianSteeringShare: sql`excluded.median_steering_share`,
				q25SteeringShare: sql`excluded.q25_steering_share`,
				lowSteeringRatio: sql`excluded.low_steering_ratio`,
				zeroControlRatio: sql`excluded.zero_control_ratio`,
				medianBrakeShare: sql`excluded.median_brake_share`,
				medianArmsUpShare: sql`excluded.median_arms_up_share`,
				medianControlTransitionRate: sql`excluded.median_control_transition_rate`,
				dateUpdated,
			},
		})
}

export async function upsertLevelPoints(payload: UpdateLevelPointsPayload): Promise<void> {
	const dateUpdated = new Date().toISOString()
	const { idLevel, ...values } = sanitizeLevelPointRealValues({ ...payload, dateUpdated })

	await db.transaction(async (tx) => {
		const existing = await tx
			.select({ idLevel: levelPoints.idLevel })
			.from(levelPoints)
			.where(eq(levelPoints.idLevel, idLevel))
			.limit(1)

		if (existing.length > 0) {
			await tx.update(levelPoints).set(values).where(eq(levelPoints.idLevel, idLevel))
		} else {
			await tx.insert(levelPoints).values({
				idLevel,
				...values,
			})
		}
	})
}

export async function setLevelPointsToZero(idLevel: number): Promise<void> {
	const dateUpdated = new Date().toISOString()
	await db
		.insert(levelPoints)
		.values({ idLevel, ...zeroLevelPointValues, dateUpdated })
		.onConflictDoUpdate({
			target: levelPoints.idLevel,
			set: {
				...zeroLevelPointValues,
				dateUpdated,
			},
		})
}

export async function setLevelPointsToZeroBulk(idLevels: number[]): Promise<void> {
	if (idLevels.length === 0) {
		return
	}

	const dateUpdated = new Date().toISOString()
	await db
		.insert(levelPoints)
		.values(idLevels.map((idLevel) => ({ idLevel, ...zeroLevelPointValues, dateUpdated })))
		.onConflictDoUpdate({
			target: levelPoints.idLevel,
			set: {
				...zeroLevelPointValues,
				dateUpdated,
			},
		})
}
