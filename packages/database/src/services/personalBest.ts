import { eq, sql } from 'drizzle-orm'
import { db } from '../index'
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
				FROM ${record} AS r
				WHERE r.id_level = ${personalBestGlobal.idLevel}
				AND r.time < ${record.time}
			) + 1`.as('position'),
		})
		.from(personalBestGlobal)
		.innerJoin(levelPoints, eq(levelPoints.idLevel, personalBestGlobal.idLevel))
		.innerJoin(record, eq(record.id, personalBestGlobal.idRecord))
		.where(eq(personalBestGlobal.idUser, idUser))
		.orderBy(personalBestGlobal.idLevel)

	return personalBests
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
