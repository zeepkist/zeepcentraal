import { inArray, sql } from 'drizzle-orm'
import { arrayParam } from '../arrayParam'
import { db } from '../client'
import { discordActivityEvent, userPointContribution, userPoints } from '../schema'
import { lockUserScores } from './scoreLocks'
import { sortedUniqueUserIds } from './userPointContributionHelpers'

export const USER_SCORE_WRITE_BATCH_SIZE = 50

function chunks<T>(items: T[], size = USER_SCORE_WRITE_BATCH_SIZE): T[][] {
	const result: T[][] = []
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size))
	}
	return result
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

export async function updateUserRanks(
	entries: Array<{ idUser: number; rank: number }>,
	onBatchCompleted?: (processed: number, total: number) => void,
) {
	if (entries.length === 0) {
		return
	}
	const allChanges: Array<{ idUser: number; previousRank: number; rank: number }> = []
	let processed = 0
	for (const batch of chunks(entries)) {
		const values = sql.join(
			batch.map((entry) => sql`(${entry.idUser}::integer, ${entry.rank}::integer)`),
			sql`, `,
		)
		const changes = await db.transaction(async (tx) => {
			await lockUserScores(
				tx,
				batch.map((entry) => entry.idUser),
			)
			const batchChanges = await tx.execute<{
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
			if (batchChanges.length > 0) {
				await tx.insert(discordActivityEvent).values({
					kind: 'rank_batch',
					payload: { changes: batchChanges },
				})
			}
			return batchChanges
		})
		// Bun SQL adapter currently erases the execute<T> row type.
		allChanges.push(...(changes as (typeof allChanges)[number][]))
		processed += batch.length
		onBatchCompleted?.(processed, entries.length)
	}
	return allChanges
}

export async function rankActiveUsersByPoints(idUsers: number[]): Promise<number> {
	const uniqueUserIds = sortedUniqueUserIds(idUsers)
	if (uniqueUserIds.length === 0) return 0

	return db.transaction(async (tx) => {
		await lockUserScores(tx, uniqueUserIds)
		const changes = await tx.execute<{
			idUser: number
			previousRank: number
			rank: number
		}>(sql`
			WITH ranked AS MATERIALIZED (
				SELECT
					${userPoints.idUser} AS id_user,
					RANK() OVER (ORDER BY ${userPoints.points} DESC)::integer AS rank
				FROM ${userPoints}
				WHERE ${userPoints.idUser} = ANY(${arrayParam(uniqueUserIds)}::integer[])
			), changed AS MATERIALIZED (
				SELECT target.id_user, target.rank AS previous_rank, ranked.rank
				FROM ${userPoints} AS target
				INNER JOIN ranked ON ranked.id_user = target.id_user
				WHERE target.rank IS DISTINCT FROM ranked.rank
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
			ORDER BY changed.rank, changed.id_user
		`)

		for (const batch of chunks(changes)) {
			await tx.insert(discordActivityEvent).values({
				kind: 'rank_batch',
				payload: { changes: batch },
			})
		}
		return changes.length
	})
}

export async function resetInactiveUserScores(idUsers: number[]): Promise<void> {
	const uniqueUserIds = sortedUniqueUserIds(idUsers)
	if (uniqueUserIds.length === 0) {
		return
	}

	for (const candidates of chunks(uniqueUserIds)) {
		await db.transaction(async (tx) => {
			await lockUserScores(tx, candidates)
			// Recheck activity after obtaining the same lock as record submission.
			const cutoff = new Date()
			cutoff.setMonth(cutoff.getMonth() - 6)
			const eligible = await tx.execute<{ id: number }>(sql`
    SELECT candidate.id FROM UNNEST(${arrayParam(candidates)}::integer[]) AS candidate(id)
    WHERE NOT EXISTS (SELECT 1 FROM record WHERE id_user=candidate.id AND date_created>=${cutoff.toISOString()}::timestamptz)
   `)
			const batch = eligible.map(({ id }) => id)
			if (!batch.length) return
			const previous = await tx.execute<{ idUser: number; previousRank: number }>(sql`
			SELECT
				${userPoints.idUser} AS "idUser",
				${userPoints.rank} AS "previousRank"
			FROM ${userPoints}
			WHERE ${userPoints.idUser} = ANY(${arrayParam(batch)}::integer[])
				AND ${userPoints.rank} IS DISTINCT FROM -1
		`)
			await tx.execute(sql`
			UPDATE ${userPoints}
			SET points = 0, rank = -1, date_updated = NOW()
			WHERE id_user = ANY(${arrayParam(batch)}::integer[])
				AND ROW(points, rank) IS DISTINCT FROM ROW(0, -1)
		`)
			await tx.execute(sql`
			UPDATE ${userPointContribution}
			SET player_decayed_points = 0, date_calculated = NOW()
			WHERE id_user = ANY(${arrayParam(batch)}::integer[])
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
}
