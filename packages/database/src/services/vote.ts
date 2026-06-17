import { and, eq, sql } from 'drizzle-orm'
import { db } from '../index'
import { vote } from '../schema'

export async function upsertVote(userId: number, levelId: number, value: number) {
	const existing = await db.query.vote.findFirst({
		where: and(eq(vote.idUser, userId), eq(vote.idLevel, levelId)),
	})

	if (existing) {
		const [updated] = await db
			.update(vote)
			.set({ value, dateUpdated: new Date().toISOString() })
			.where(eq(vote.id, existing.id))
			.returning()
		return updated
	}

	const [created] = await db
		.insert(vote)
		.values({ idUser: userId, idLevel: levelId, value })
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
