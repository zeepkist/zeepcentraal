import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { discordActivityEvent, userPointContribution, userPoints } from '../schema'
import { acquireUserContributionLocks, sortedUniqueUserIds } from './userPointContributionHelpers'

interface UserPointsInput {
	idUser: number
	points: number
	totalPoints: number
}

export async function getTotalUserPoints() {
	const totalPoints = await db
		.select({ count: sql<number>`COUNT(*)` })
		.from(userPoints)
		.then((rows) => Number(rows[0]?.count))

	return totalPoints ?? 0
}

export async function getUserPointsPaginated(offset: number, limit: number) {
	return db
		.select({
			idUser: userPoints.idUser,
			points: userPoints.points,
			totalPoints: userPoints.totalPoints,
			rank: userPoints.rank,
			worldRecords: userPoints.worldRecords,
		})
		.from(userPoints)
		.limit(limit)
		.offset(offset)
}

export async function getAllUserPointIds(): Promise<number[]> {
	const rows = await db
		.select({ idUser: userPoints.idUser })
		.from(userPoints)
		.orderBy(userPoints.idUser)
	return rows.map((row) => row.idUser)
}

export async function getUserPointsByIds(ids: number[]) {
	if (ids.length === 0) {
		return []
	}
	return db
		.select({
			idUser: userPoints.idUser,
			points: userPoints.points,
			totalPoints: userPoints.totalPoints,
			rank: userPoints.rank,
			worldRecords: userPoints.worldRecords,
		})
		.from(userPoints)
		.where(inArray(userPoints.idUser, ids))
}

export async function upsertUserPoints({
	idUser,
	points,
	totalPoints,
}: UserPointsInput): Promise<void> {
	await db.transaction(async (tx) => {
		const dateUpdated = new Date().toISOString()
		const [updated] = await tx
			.update(userPoints)
			.set({
				points,
				totalPoints,
				dateUpdated,
			})
			.where(eq(userPoints.idUser, idUser))
			.returning({ idUser: userPoints.idUser })
		if (updated) {
			return
		}

		await tx
			.insert(userPoints)
			.values({
				idUser,
				points,
				totalPoints,
				dateUpdated,
			})
			.onConflictDoUpdate({
				target: [userPoints.idUser],
				set: {
					points,
					totalPoints,
					dateUpdated,
				},
			})
	})
}

function dedupeUserPointsEntries(entries: UserPointsInput[]): UserPointsInput[] {
	return [...new Map(entries.map((entry) => [entry.idUser, entry])).values()]
}

export async function upsertUserPointsBulk(entries: UserPointsInput[]) {
	if (entries.length === 0) {
		return
	}
	const dedupedEntries = dedupeUserPointsEntries(entries)
	const dateUpdated = new Date().toISOString()

	await db
		.insert(userPoints)
		.values(dedupedEntries.map((entry) => ({ ...entry, dateUpdated })))
		.onConflictDoUpdate({
			target: [userPoints.idUser],
			set: {
				points: sql`EXCLUDED.points`,
				totalPoints: sql`EXCLUDED.total_points`,
				dateUpdated,
			},
			where: sql`ROW(${userPoints.points}, ${userPoints.totalPoints}) IS DISTINCT FROM ROW(EXCLUDED.points, EXCLUDED.total_points)`,
		})
}

export async function updateUserRanks(entries: Array<{ idUser: number; rank: number }>) {
	if (entries.length === 0) {
		return
	}
	const values = sql.join(
		entries.map((entry) => sql`(${entry.idUser}::integer, ${entry.rank}::integer)`),
		sql`, `,
	)
	return db.transaction(async (tx) => {
		const changes = await tx.execute<{
			idUser: number
			previousRank: number
			rank: number
		}>(sql`
			WITH source(id_user, rank) AS (VALUES ${values}),
			changed AS MATERIALIZED (
				SELECT target.id_user, target.rank AS previous_rank, source.rank
				FROM ${userPoints} AS target
				INNER JOIN source ON source.id_user = target.id_user
				WHERE target.rank IS DISTINCT FROM source.rank
			), updated AS (
				UPDATE ${userPoints} AS target
				SET rank = changed.rank, date_updated = NOW()
				FROM changed
				WHERE target.id_user = changed.id_user
				RETURNING target.id_user
			)
			SELECT
				changed.id_user AS "idUser",
				changed.previous_rank AS "previousRank",
				changed.rank
			FROM changed
			INNER JOIN updated ON updated.id_user = changed.id_user
		`)
		if (changes.length > 0) {
			await tx.insert(discordActivityEvent).values({
				kind: 'rank_batch',
				payload: { changes },
			})
		}
		return changes
	})
}

export async function resetInactiveUserScores(idUsers: number[]): Promise<void> {
	const uniqueUserIds = sortedUniqueUserIds(idUsers)
	if (uniqueUserIds.length === 0) {
		return
	}

	await db.transaction(async (tx) => {
		await acquireUserContributionLocks(tx, uniqueUserIds)
		const previous = await tx.execute<{ idUser: number; previousRank: number }>(sql`
			SELECT
				${userPoints.idUser} AS "idUser",
				${userPoints.rank} AS "previousRank"
			FROM ${userPoints}
			WHERE ${userPoints.idUser} = ANY(${sql.param(uniqueUserIds)}::integer[])
				AND ${userPoints.rank} IS DISTINCT FROM -1
		`)
		await tx.execute(sql`
			UPDATE ${userPoints}
			SET points = 0, rank = -1, date_updated = NOW()
			WHERE id_user = ANY(${sql.param(uniqueUserIds)}::integer[])
				AND ROW(points, rank) IS DISTINCT FROM ROW(0, -1)
		`)
		await tx.execute(sql`
			UPDATE ${userPointContribution}
			SET player_decayed_points = 0, date_calculated = NOW()
			WHERE id_user = ANY(${sql.param(uniqueUserIds)}::integer[])
				AND player_decayed_points IS DISTINCT FROM 0::real
		`)
		if (previous.length > 0) {
			await tx.insert(discordActivityEvent).values({
				kind: 'rank_batch',
				payload: {
					changes: previous.map((entry) => ({ ...entry, rank: -1 })),
				},
			})
		}
	})
}
