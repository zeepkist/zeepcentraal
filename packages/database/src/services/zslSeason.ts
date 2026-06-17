import { eq } from 'drizzle-orm'
import { db } from '../index'
import { zslSeason } from '../schema'

export async function getZslSeasons() {
	const seasons = await db
		.select({
			id: zslSeason.id,
			idPointsStructure: zslSeason.idPointsStructure,
			name: zslSeason.name,
			startDate: zslSeason.dateStarted,
			endDate: zslSeason.dateEnded,
		})
		.from(zslSeason)
		.orderBy(zslSeason.id)

	return seasons
}

interface GetOrCreateZslSeasonOptions {
	idPointsStructure: number
	startDate: string
	endDate: string
}

export async function getOrCreateZslSeason(
	name: string,
	{ idPointsStructure, startDate, endDate }: GetOrCreateZslSeasonOptions,
) {
	const existingSeason = await db
		.select({
			id: zslSeason.id,
			idPointsStructure: zslSeason.idPointsStructure,
			name: zslSeason.name,
			startDate: zslSeason.dateStarted,
			endDate: zslSeason.dateEnded,
		})
		.from(zslSeason)
		.where(eq(zslSeason.name, name))
		.then((rows) => rows[0])

	if (existingSeason) {
		return existingSeason
	}

	console.warn(`ZSL season "${name}" not found, creating new one`)

	const dateStarted = new Date(startDate)
	dateStarted.setUTCHours(18, 0, 0, 0)

	const dateEnded = new Date(endDate)
	dateEnded.setUTCHours(18, 0, 0, 0)

	const [createdSeason] = await db.transaction(async (tx) => {
		const inserted = await tx
			.insert(zslSeason)
			.values({
				name,
				idPointsStructure,
				dateStarted: dateStarted.toISOString(),
				dateEnded: dateEnded.toISOString(),
			})
			.returning()

		return inserted
	})

	return createdSeason
}
