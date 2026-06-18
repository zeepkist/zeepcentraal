import { sql } from 'drizzle-orm'
import { db } from '../client'
import { zslLevelResult } from '../schema'

interface ZslLevelResultInput {
	idLevel: number
	idUser: number
	position: number
	points: number
	time: number
}

export async function upsertZslLevelResults(rows: ZslLevelResultInput[]) {
	if (rows.length === 0) {
		return
	}

	await db.transaction(async (tx) => {
		await tx
			.insert(zslLevelResult)
			.values(rows)
			.onConflictDoUpdate({
				target: [zslLevelResult.idLevel, zslLevelResult.idUser],
				set: {
					points: sql`EXCLUDED.points`,
					position: sql`EXCLUDED.position`,
					time: sql`EXCLUDED.time`,
				},
			})
	})
}
