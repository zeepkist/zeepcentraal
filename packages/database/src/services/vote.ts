import { eq, sql } from 'drizzle-orm'
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
