import { STEAM_ACCESSIBLE_VISIBILITIES } from '@zeepkist/core/steam'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { level, levelItem, personalBestGlobal, user, workshopItem } from '../schema'

export async function getPersonalBestCount90thPercentile() {
	const accessibleWorkshopItem = inArray(workshopItem.visibility, [
		...STEAM_ACCESSIBLE_VISIBILITIES,
	])
	const [result] = await db
		.select({
			percentile: sql<number>`PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pb_count)`.as(
				'percentile',
			),
		})
		.from(
			db
				.select({
					idLevel: level.id,
					pb_count: sql<number>`COUNT(${user.id})`.as('pb_count'),
				})
				.from(level)
				.leftJoin(personalBestGlobal, eq(personalBestGlobal.idLevel, level.id))
				.leftJoin(user, and(eq(user.id, personalBestGlobal.idUser), eq(user.banned, false)))
				.where(
					sql<boolean>`(
							${level.adventure} = true
							OR NOT EXISTS (
								SELECT 1
								FROM ${levelItem}
								WHERE ${levelItem.idLevel} = ${level.id}
							)
							OR EXISTS (
								SELECT 1
								FROM ${levelItem}
								INNER JOIN ${workshopItem}
									ON ${workshopItem.workshopId} = ${levelItem.workshopId}
								WHERE ${levelItem.idLevel} = ${level.id}
									AND ${levelItem.deleted} = false
									AND ${accessibleWorkshopItem}
							)
						)`,
				)
				.groupBy(level.id)
				.as('level_pb_counts'),
		)
		.execute()

	return result?.percentile ?? 0
}
