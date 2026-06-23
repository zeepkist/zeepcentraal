import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { vote } from '../schema'

export async function upsertVote(userId: number, levelId: number, value: number) {
	const [created] = await db
		.insert(vote)
		.values({ idUser: userId, idLevel: levelId, value })
		.onConflictDoUpdate({
			target: [vote.idUser, vote.idLevel],
			set: { value, dateUpdated: new Date().toISOString() },
		})
		.returning()
	return created
}

export async function getVoteValues({ idLevel }: { idLevel: number }): Promise<number[]> {
	const voteValues = await db
		.select({
			values: sql<number[]>`ARRAY_AGG(${vote.value}::float8)`.as('values'),
		})
		.from(vote)
		.where(eq(vote.idLevel, idLevel))
		.then((rows) => rows[0]?.values ?? [])

	return voteValues
}

export async function getVoteValuesByLevelIds(idLevels: number[]): Promise<Map<number, number[]>> {
	if (idLevels.length === 0) {
		return new Map()
	}

	const rows = await db
		.select({
			idLevel: vote.idLevel,
			values: sql<number[]>`ARRAY_AGG(${vote.value}::float8)`.as('values'),
		})
		.from(vote)
		.where(inArray(vote.idLevel, idLevels))
		.groupBy(vote.idLevel)

	return new Map(rows.map((row) => [row.idLevel, row.values]))
}
