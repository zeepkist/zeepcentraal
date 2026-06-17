import { and, eq } from 'drizzle-orm'
import { db } from '../index'
import { zslRound } from '../schema'

interface GetZslRoundInput {
	idSeason: number
	round: number
	name: string
	workshopId: string
	date: string
}

export async function getOrCreateZslRound({
	idSeason,
	round,
	name,
	workshopId,
	date,
}: GetZslRoundInput) {
	const existingRound = await db
		.select({
			id: zslRound.id,
			name: zslRound.name,
			round: zslRound.round,
			workshopId: zslRound.workshopId,
			eventDate: zslRound.eventDate,
		})
		.from(zslRound)
		.where(and(eq(zslRound.idSeason, idSeason), eq(zslRound.round, round)))
		.then((rows) => rows[0])

	const parsedWorkshopId = /^\d+$/.test(workshopId) ? BigInt(workshopId) : BigInt(0)
	const eventDate = new Date(date).toISOString()

	if (existingRound) {
		const needsUpdate =
			existingRound.name !== name ||
			existingRound.workshopId !== parsedWorkshopId ||
			new Date(existingRound.eventDate).getTime() !== new Date(eventDate).getTime()

		if (!needsUpdate) {
			return existingRound
		}

		const [updatedRound] = await db
			.update(zslRound)
			.set({
				name,
				workshopId: parsedWorkshopId,
				eventDate,
			})
			.where(eq(zslRound.id, existingRound.id))
			.returning()

		return updatedRound
	}

	const [createdRound] = await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(zslRound)
			.values({
				idSeason,
				round,
				name,
				workshopId: parsedWorkshopId,
				eventDate,
			})
			.returning()

		return inserted
	})

	return createdRound
}
