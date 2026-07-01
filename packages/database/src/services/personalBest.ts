import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { levelPoints, personalBestGlobal, record } from '../schema'

export interface PersonalBestWithLevelPointsAndPosition {
	idUser: number
	idLevel: number
	idRecord: number
	levelPoints: number
	position: bigint
}

export async function getPersonalBestLevelIdsForUsers(idUsers: number[]): Promise<number[]> {
	if (idUsers.length === 0) {
		return []
	}

	const rows = await db
		.selectDistinct({
			idLevel: personalBestGlobal.idLevel,
		})
		.from(personalBestGlobal)
		.where(inArray(personalBestGlobal.idUser, idUsers))

	return rows.map((row) => row.idLevel)
}

export async function getLevelsPersonalBestsWithLevelPointsAndPosition(
	idLevels: number[],
): Promise<Map<number, PersonalBestWithLevelPointsAndPosition[]>> {
	if (idLevels.length === 0) {
		return new Map()
	}

	const rankedPersonalBests = db.$with('ranked_personal_bests').as(
		db
			.select({
				idUser: personalBestGlobal.idUser,
				idLevel: personalBestGlobal.idLevel,
				idRecord: personalBestGlobal.idRecord,
				levelPoints: levelPoints.points,
				position:
					sql<bigint>`RANK() OVER (PARTITION BY ${personalBestGlobal.idLevel} ORDER BY ${record.time})`.as(
						'position',
					),
			})
			.from(personalBestGlobal)
			.innerJoin(levelPoints, eq(levelPoints.idLevel, personalBestGlobal.idLevel))
			.innerJoin(record, eq(record.id, personalBestGlobal.idRecord))
			.where(inArray(personalBestGlobal.idLevel, idLevels)),
	)

	const rows = await db
		.with(rankedPersonalBests)
		.select()
		.from(rankedPersonalBests)
		.orderBy(rankedPersonalBests.idLevel, rankedPersonalBests.position)

	const grouped = new Map<number, PersonalBestWithLevelPointsAndPosition[]>()
	for (const row of rows) {
		const entries = grouped.get(row.idLevel) ?? []
		entries.push(row)
		grouped.set(row.idLevel, entries)
	}
	return grouped
}

export function buildUsersPersonalBestsWithLevelPointsAndPositionQuery(idUsers: number[]) {
	const requestedUserLevels = db.$with('requested_user_levels').as(
		db
			.selectDistinct({
				idLevel: personalBestGlobal.idLevel,
			})
			.from(personalBestGlobal)
			.where(inArray(personalBestGlobal.idUser, idUsers)),
	)
	const rankedPersonalBests = db.$with('ranked_personal_bests').as(
		db
			.select({
				idUser: personalBestGlobal.idUser,
				idLevel: personalBestGlobal.idLevel,
				idRecord: personalBestGlobal.idRecord,
				levelPoints: levelPoints.points,
				position:
					sql<bigint>`RANK() OVER (PARTITION BY ${personalBestGlobal.idLevel} ORDER BY ${record.time})`.as(
						'position',
					),
			})
			.from(personalBestGlobal)
			.innerJoin(levelPoints, eq(levelPoints.idLevel, personalBestGlobal.idLevel))
			.innerJoin(record, eq(record.id, personalBestGlobal.idRecord))
			.where(
				inArray(
					personalBestGlobal.idLevel,
					db.select({ idLevel: requestedUserLevels.idLevel }).from(requestedUserLevels),
				),
			),
	)

	return db
		.with(requestedUserLevels, rankedPersonalBests)
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
