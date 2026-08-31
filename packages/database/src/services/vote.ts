import { and, eq, inArray, lte, sql } from 'drizzle-orm'
import { type DatabaseExecutor, db } from '../client'
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

export async function getVoteValues({
	idLevel,
	eligibleBefore,
}: {
	idLevel: number
	eligibleBefore?: string
}): Promise<number[]> {
	const voteValues = await db
		.select({
			values: sql<number[]>`ARRAY_AGG(${vote.value}::float8)`.as('values'),
		})
		.from(vote)
		.where(
			and(
				eq(vote.idLevel, idLevel),
				eligibleBefore
					? lte(
							sql<string>`COALESCE(${vote.dateUpdated}, ${vote.dateCreated})`,
							eligibleBefore,
						)
					: undefined,
			),
		)
		.then((rows) => rows[0]?.values ?? [])

	return voteValues
}

export async function getVoteValuesByLevelIds(
	idLevels: number[],
	eligibleBefore?: string,
	executor: DatabaseExecutor = db,
): Promise<Map<number, number[]>> {
	if (idLevels.length === 0) {
		return new Map()
	}

	const rows = await executor
		.select({
			idLevel: vote.idLevel,
			values: sql<number[]>`ARRAY_AGG(${vote.value}::float8)`.as('values'),
		})
		.from(vote)
		.where(
			and(
				inArray(vote.idLevel, idLevels),
				eligibleBefore
					? lte(
							sql<string>`COALESCE(${vote.dateUpdated}, ${vote.dateCreated})`,
							eligibleBefore,
						)
					: undefined,
			),
		)
		.groupBy(vote.idLevel)

	return new Map(rows.map((row) => [row.idLevel, row.values]))
}
