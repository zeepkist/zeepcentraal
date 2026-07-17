import { db } from '../client'
import { type levelPoints, levelPointsHistory } from '../schema'

type LevelPoints = typeof levelPoints.$inferSelect

type LevelPointsHistory = typeof levelPointsHistory.$inferInsert

export async function insertLevelPointsHistories(entries: LevelPoints[]) {
	const now = new Date().toISOString()

	const histories: LevelPointsHistory[] = entries.map((entry) => ({
		...entry,
		dateCreated: now,
	}))

	await db.transaction(async (tx) => {
		await tx.insert(levelPointsHistory).values(histories)
	})
}
