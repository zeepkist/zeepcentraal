import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { levelPoints, personalBestGlobal, record } from '../schema'

export async function getUserPersonalBestsWithLevelPointsAndPosition({
	idUser,
}: {
	idUser: number
}) {
	const personalBests = await db
		.select({
			idUser: personalBestGlobal.idUser,
			idLevel: personalBestGlobal.idLevel,
			levelPoints: levelPoints.points,
			position: sql<bigint>`(
				SELECT COUNT(*)
				FROM personal_best_global AS pb2
				INNER JOIN record AS r2 ON r2.id = pb2.id_record
				WHERE pb2.id_level = ${personalBestGlobal.idLevel}
				AND r2.time < ${record.time}
			) + 1`.as('position'),
		})
		.from(personalBestGlobal)
		.innerJoin(levelPoints, eq(levelPoints.idLevel, personalBestGlobal.idLevel))
		.innerJoin(record, eq(record.id, personalBestGlobal.idRecord))
		.where(eq(personalBestGlobal.idUser, idUser))
		.orderBy(personalBestGlobal.idLevel)

	return personalBests
}

export async function getUsersPersonalBestsWithLevelPointsAndPosition(idUsers: number[]) {
	if (idUsers.length === 0) {
		return new Map<
			number,
			Awaited<ReturnType<typeof getUserPersonalBestsWithLevelPointsAndPosition>>
		>()
	}
	const rows = await db
		.select({
			idUser: personalBestGlobal.idUser,
			idLevel: personalBestGlobal.idLevel,
			levelPoints: levelPoints.points,
			position: sql<bigint>`(
				SELECT COUNT(*)
				FROM personal_best_global AS pb2
				INNER JOIN record AS r2 ON r2.id = pb2.id_record
				WHERE pb2.id_level = ${personalBestGlobal.idLevel}
				AND r2.time < ${record.time}
			) + 1`.as('position'),
		})
		.from(personalBestGlobal)
		.innerJoin(levelPoints, eq(levelPoints.idLevel, personalBestGlobal.idLevel))
		.innerJoin(record, eq(record.id, personalBestGlobal.idRecord))
		.where(inArray(personalBestGlobal.idUser, idUsers))
		.orderBy(personalBestGlobal.idUser, personalBestGlobal.idLevel)

	const grouped = new Map<number, typeof rows>()
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
