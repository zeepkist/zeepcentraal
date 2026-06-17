import { and, eq } from 'drizzle-orm'
import { db } from '../index'
import { zslLevel } from '../schema'

interface GetZslLevelInput {
	idRound: number
	idLevel: number
}

export async function getOrCreateZslLevel({ idRound, idLevel }: GetZslLevelInput) {
	const existingLevel = await db
		.select({ id: zslLevel.id })
		.from(zslLevel)
		.where(and(eq(zslLevel.idRound, idRound), eq(zslLevel.idLevel, idLevel)))
		.then((rows) => rows[0])

	if (existingLevel) {
		return existingLevel
	}

	const [createdLevel] = await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(zslLevel)
			.values({
				idRound,
				idLevel,
			})
			.returning()

		return inserted
	})

	return createdLevel
}
