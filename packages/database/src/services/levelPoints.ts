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

interface UpdateLevelPointsPayload {
	idLevel: number
	points: number
	rating: number
	lengthModifier: number
	competitivenessModifier: number
	ratingModifier: number
	popularityModifier: number
	cutPenalty: number
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
