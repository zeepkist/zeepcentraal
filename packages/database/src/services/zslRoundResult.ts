import { sql } from 'drizzle-orm'
import { db } from '../client'
import { zslRoundResult } from '../schema'

interface ZslRoundResultInput {
	idRound: number
	idUser: number
	points: number
	position: number
}

export async function upsertZslRoundResults(rows: ZslRoundResultInput[]) {
	if (rows.length === 0) {
		return
	}

	await db.transaction(async (tx) => {
		await tx
			.insert(zslRoundResult)
			.values(rows)
			.onConflictDoUpdate({
				target: [zslRoundResult.idRound, zslRoundResult.idUser],
				set: {
					points: sql`EXCLUDED.points`,
					position: sql`EXCLUDED.position`,
				},
			})
	})
}
