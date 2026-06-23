import { eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '../client'
import { levelPoints, levelPointsHistory } from '../schema'

export async function getTotalLevelPoints() {
	const totalPoints = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(levelPoints)
		.then((rows) => Number(rows[0]?.count))

	return totalPoints ?? 0
}

export async function getChangedLevelPointsPaginated(offset: number, limit: number) {
	const latestHistory = db
		.select({
			idLevel: levelPointsHistory.idLevel,
			points: levelPointsHistory.points,
		})
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
		.select({
			idLevel: levelPoints.idLevel,
			points: levelPoints.points,
			rating: levelPoints.rating,
			lengthModifier: levelPoints.lengthModifier,
			competitivenessModifier: levelPoints.competitivenessModifier,
			ratingModifier: levelPoints.ratingModifier,
			popularityModifier: levelPoints.popularityModifier,
			cutPenalty: levelPoints.cutPenalty,
		})
		.from(levelPoints)
		.innerJoin(latestHistory, eq(levelPoints.idLevel, latestHistory.idLevel))
		.where(ne(levelPoints.points, latestHistory.points))
		.offset(offset)
		.limit(limit)
}

export async function getChangedLevelPointIds(): Promise<number[]> {
	const latestHistory = db
		.select({
			idLevel: levelPointsHistory.idLevel,
			points: levelPointsHistory.points,
		})
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
			sql`${latestHistory.idLevel} IS NULL OR ${levelPoints.points} <> ${latestHistory.points}`,
		)
		.orderBy(levelPoints.idLevel)
	return rows.map((row) => row.idLevel)
}

export async function getLevelPointsByIds(ids: number[]) {
	if (ids.length === 0) {
		return []
	}
	return db
		.select({
			idLevel: levelPoints.idLevel,
			points: levelPoints.points,
			rating: levelPoints.rating,
			lengthModifier: levelPoints.lengthModifier,
			competitivenessModifier: levelPoints.competitivenessModifier,
			ratingModifier: levelPoints.ratingModifier,
			popularityModifier: levelPoints.popularityModifier,
			cutPenalty: levelPoints.cutPenalty,
		})
		.from(levelPoints)
		.where(inArray(levelPoints.idLevel, ids))
}

export interface UpdateLevelPointsPayload {
	idLevel: number
	points: number
	rating: number
	lengthModifier: number
	competitivenessModifier: number
	ratingModifier: number
	popularityModifier: number
	cutPenalty: number
}

export async function upsertLevelPointsBulk(payloads: UpdateLevelPointsPayload[]): Promise<void> {
	if (payloads.length === 0) {
		return
	}

	const dateUpdated = new Date().toISOString()
	await db
		.insert(levelPoints)
		.values(payloads.map((payload) => ({ ...payload, dateUpdated })))
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
				dateUpdated,
			},
		})
}

export async function upsertLevelPoints({
	idLevel,
	points,
	rating,
	lengthModifier,
	competitivenessModifier,
	ratingModifier,
	popularityModifier,
	cutPenalty,
}: UpdateLevelPointsPayload): Promise<void> {
	const dateUpdated = new Date().toISOString()

	await db.transaction(async (tx) => {
		const existing = await tx
			.select({ idLevel: levelPoints.idLevel })
			.from(levelPoints)
			.where(eq(levelPoints.idLevel, idLevel))
			.limit(1)

		if (existing.length > 0) {
			await tx
				.update(levelPoints)
				.set({
					points,
					dateUpdated,
					rating,
					lengthModifier,
					competitivenessModifier,
					ratingModifier,
					popularityModifier,
					cutPenalty,
				})
				.where(eq(levelPoints.idLevel, idLevel))
		} else {
			await tx.insert(levelPoints).values({
				idLevel,
				points,
				dateUpdated,
				rating,
				lengthModifier,
				competitivenessModifier,
				ratingModifier,
				popularityModifier,
				cutPenalty,
			})
		}
	})
}

export async function setLevelPointsToZero(idLevel: number): Promise<void> {
	await db
		.insert(levelPoints)
		.values({ idLevel, points: 0 })
		.onConflictDoUpdate({
			target: levelPoints.idLevel,
			set: {
				points: 0,
				dateUpdated: new Date().toISOString(),
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
		.values(idLevels.map((idLevel) => ({ idLevel, points: 0, dateUpdated })))
		.onConflictDoUpdate({
			target: levelPoints.idLevel,
			set: {
				points: 0,
				dateUpdated,
			},
		})
}
