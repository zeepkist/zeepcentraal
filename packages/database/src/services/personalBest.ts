import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { levelPoints, personalBestGlobal, record } from '../schema'

interface PersonalBestWithLevelPointsAndPosition {
	idUser: number
	idLevel: number
	levelPoints: number
	position: bigint
}

export function buildUsersPersonalBestsWithLevelPointsAndPositionQuery(idUsers: number[]) {
	const rankedPersonalBests = db.$with('ranked_personal_bests').as(
		db
			.select({
				idUser: personalBestGlobal.idUser,
				idLevel: personalBestGlobal.idLevel,
				levelPoints: levelPoints.points,
				position:
					sql<bigint>`RANK() OVER (PARTITION BY ${personalBestGlobal.idLevel} ORDER BY ${record.time})`.as(
						'position',
					),
			})
			.from(personalBestGlobal)
			.innerJoin(levelPoints, eq(levelPoints.idLevel, personalBestGlobal.idLevel))
			.innerJoin(record, eq(record.id, personalBestGlobal.idRecord)),
	)

	return db
		.with(rankedPersonalBests)
		.select()
		.from(rankedPersonalBests)
		.where(inArray(rankedPersonalBests.idUser, idUsers))
		.orderBy(rankedPersonalBests.idUser, rankedPersonalBests.idLevel)
}

export async function getUserPersonalBestsWithLevelPointsAndPosition({
	idUser,
}: {
	idUser: number
}): Promise<PersonalBestWithLevelPointsAndPosition[]> {
	const personalBestsByUser = await getUsersPersonalBestsWithLevelPointsAndPosition([idUser])
	return personalBestsByUser.get(idUser) ?? []
}

export async function getUsersPersonalBestsWithLevelPointsAndPosition(
	idUsers: number[],
): Promise<Map<number, PersonalBestWithLevelPointsAndPosition[]>> {
	if (idUsers.length === 0) {
		return new Map()
	}
	const rows = await buildUsersPersonalBestsWithLevelPointsAndPositionQuery(idUsers)

	const grouped = new Map<number, PersonalBestWithLevelPointsAndPosition[]>()
	for (const row of rows) {
		const entries = grouped.get(row.idUser) ?? []
		entries.push(row)
		grouped.set(row.idUser, entries)
	}
	return grouped
}

export async function getPersonalBestCount90thPercentile() {
	const [result] = await db
		.select({
			percentile: sql<number>`PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pb_count)`.as(
				'percentile',
			),
		})
		.from(
			db
				.select({
					idLevel: personalBestGlobal.idLevel,
					pb_count: sql<number>`COUNT(*)`.as('pb_count'),
				})
				.from(personalBestGlobal)
				.groupBy(personalBestGlobal.idLevel)
				.as('level_pb_counts'),
		)
		.execute()

	return result?.percentile ?? 0
}
