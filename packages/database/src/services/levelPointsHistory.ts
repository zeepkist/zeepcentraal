import { db } from '../index'
import { type levelPoints, levelPointsHistory } from '../schema'

type LevelPoints = Pick<
	typeof levelPoints.$inferInsert,
	| 'idLevel'
	| 'points'
	| 'rating'
	| 'lengthModifier'
	| 'competitivenessModifier'
	| 'ratingModifier'
	| 'popularityModifier'
	| 'cutPenalty'
>

type LevelPointsHistory = typeof levelPointsHistory.$inferInsert

export async function insertLevelPointsHistories(entries: LevelPoints[]) {
	const now = new Date().toISOString()

	const histories: LevelPointsHistory[] = entries.map((entry) => ({
		idLevel: entry.idLevel,
		points: entry.points,
		rating: entry.rating,
		lengthModifier: entry.lengthModifier,
		competitivenessModifier: entry.competitivenessModifier,
		ratingModifier: entry.ratingModifier,
		popularityModifier: entry.popularityModifier,
		cutPenalty: entry.cutPenalty,
		dateCreated: now,
	}))

	await db.transaction(async (tx) => {
		await tx.insert(levelPointsHistory).values(histories)
	})
}
