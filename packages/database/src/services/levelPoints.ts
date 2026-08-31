import { eq, getTableColumns, inArray, type SQLWrapper, sql } from 'drizzle-orm'
import { type DatabaseExecutor, db } from '../client'
import { levelPoints, levelPointsHistory } from '../schema'
import { sanitizeLevelPointRealValues } from './levelPointRealValues'

const LATEST_HISTORY_ALIAS = 'latest_history'
const latestHistoryRow = sql.identifier(LATEST_HISTORY_ALIAS)

function levelPointHistoryChanged(latestHistoryIdLevel: SQLWrapper) {
	return sql<boolean>`
		${latestHistoryIdLevel} IS NULL
		OR (
			(to_jsonb(${levelPoints}) - 'id_level' - 'date_created' - 'date_updated')
			IS DISTINCT FROM
			(to_jsonb(${latestHistoryRow}) - 'id' - 'id_level' - 'date_created' - 'date_updated')
		)
	`
}

const unavailableLevelPointMetrics = {
	complexityConfidence: null,
	complexityScore: null,
	fieldStrength: null,
	qualityScore: null,
	skillAlignment: null,
	skillConfidence: null,
	skillSampleSize: null,
	skillScore: null,
	skillSeparation: null,
} satisfies Partial<typeof levelPoints.$inferInsert>

const zeroLevelPointValues = {
	points: 0,
	lengthModifier: 0,
	evidenceModifier: 0.2,
	qualityModifier: 0.55,
	ratingModifier: 1,
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
		.as(LATEST_HISTORY_ALIAS)

	return db
		.select({ ...getTableColumns(levelPoints) })
		.from(levelPoints)
		.leftJoin(latestHistory, eq(levelPoints.idLevel, latestHistory.idLevel))
		.where(levelPointHistoryChanged(latestHistory.idLevel))
		.orderBy(levelPoints.idLevel)
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
		.as(LATEST_HISTORY_ALIAS)

	const rows = await db
		.select({ idLevel: levelPoints.idLevel })
		.from(levelPoints)
		.leftJoin(latestHistory, eq(levelPoints.idLevel, latestHistory.idLevel))
		.where(levelPointHistoryChanged(latestHistory.idLevel))
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

export async function getLevelPointValuesByIds(ids: number[], executor: DatabaseExecutor = db) {
	if (ids.length === 0) return []
	return executor
		.select({ idLevel: levelPoints.idLevel, points: levelPoints.points })
		.from(levelPoints)
		.where(inArray(levelPoints.idLevel, ids))
}

export type UpdateLevelPointsPayload = Omit<
	typeof levelPoints.$inferInsert,
	'dateCreated' | 'dateUpdated'
>

const levelPointUpsertChanged = sql<boolean>`
	(to_jsonb(${levelPoints}) - 'id_level' - 'date_created' - 'date_updated')
	IS DISTINCT FROM
	(to_jsonb(excluded) - 'id_level' - 'date_created' - 'date_updated')
`

const zeroLevelPointUpsertChanged = sql<boolean>`ROW(
	${levelPoints.points},
	${levelPoints.lengthModifier},
	${levelPoints.evidenceModifier},
	${levelPoints.qualityModifier},
	${levelPoints.ratingModifier},
	${levelPoints.complexityConfidence},
	${levelPoints.complexityScore},
	${levelPoints.fieldStrength},
	${levelPoints.qualityScore},
	${levelPoints.skillAlignment},
	${levelPoints.skillConfidence},
	${levelPoints.skillSampleSize},
	${levelPoints.skillScore},
	${levelPoints.skillSeparation}
) IS DISTINCT FROM ROW(
	excluded.points,
	excluded.modifier_length,
	excluded.modifier_evidence,
	excluded.modifier_quality,
	excluded.modifier_rating,
	excluded.complexity_confidence,
	excluded.complexity_score,
	excluded.field_strength,
	excluded.quality_score,
	excluded.skill_alignment,
	excluded.skill_confidence,
	excluded.skill_sample_size,
	excluded.skill_score,
	excluded.skill_separation
)`

export async function upsertLevelPointsBulk(
	payloads: UpdateLevelPointsPayload[],
	executor: DatabaseExecutor = db,
): Promise<number[]> {
	if (payloads.length === 0) {
		return []
	}

	const dateUpdated = new Date().toISOString()
	const rows = await executor
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
				evidenceModifier: sql`excluded.modifier_evidence`,
				qualityModifier: sql`excluded.modifier_quality`,
				ratingModifier: sql`excluded.modifier_rating`,
				complexityConfidence: sql`excluded.complexity_confidence`,
				complexityScore: sql`excluded.complexity_score`,
				fieldStrength: sql`excluded.field_strength`,
				qualityScore: sql`excluded.quality_score`,
				skillAlignment: sql`excluded.skill_alignment`,
				skillConfidence: sql`excluded.skill_confidence`,
				skillSampleSize: sql`excluded.skill_sample_size`,
				skillScore: sql`excluded.skill_score`,
				skillSeparation: sql`excluded.skill_separation`,
				dateUpdated,
			},
			where: levelPointUpsertChanged,
		})
		.returning({ idLevel: levelPoints.idLevel })
	return rows.map((row) => row.idLevel)
}

export async function upsertLevelPoints(payload: UpdateLevelPointsPayload): Promise<void> {
	await upsertLevelPointsBulk([payload])
}

export async function setLevelPointsToZero(idLevel: number): Promise<void> {
	await setLevelPointsToZeroBulk([idLevel])
}

export async function setLevelPointsToZeroBulk(
	idLevels: number[],
	executor: DatabaseExecutor = db,
): Promise<number[]> {
	if (idLevels.length === 0) {
		return []
	}

	const dateUpdated = new Date().toISOString()
	const rows = await executor
		.insert(levelPoints)
		.values(idLevels.map((idLevel) => ({ idLevel, ...zeroLevelPointValues, dateUpdated })))
		.onConflictDoUpdate({
			target: levelPoints.idLevel,
			set: {
				...zeroLevelPointValues,
				dateUpdated,
			},
			where: zeroLevelPointUpsertChanged,
		})
		.returning({ idLevel: levelPoints.idLevel })
	return rows.map((row) => row.idLevel)
}
