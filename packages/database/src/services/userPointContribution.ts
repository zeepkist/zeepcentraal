import { LEVEL_DECAY_FACTOR, MIN_PERSISTED_DECAYED_POINTS } from '@zeepkist/core/score'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { levelPoints, personalBestGlobal, record, userPointContribution } from '../schema'
import { sortedUniqueUserIds } from './userPointContributionHelpers'

export { sortedUniqueUserIds } from './userPointContributionHelpers'

export interface UserPointContributionInput {
	contributionRank: number
	idLevel: number
	idRecord: number
	idUser: number
	levelDecayedPoints: number
	levelPoints: number
	levelPosition: number
	playerDecayedPoints: number
}

interface UserPointContributionBatchInput {
	contributions: Omit<UserPointContributionInput, 'idUser'>[]
	idUser: number
}

export interface LevelContributionProjectionSyncResult {
	levels: number
	users: number
}

// Eight bound values per contribution; 5,000 stays below PostgreSQL's parameter limit.
const WRITE_BATCH_SIZE = 5000
export const USER_POINT_CONTRIBUTION_LOCK_NAMESPACE = 1_516_438_864
export const USER_POINT_CONTRIBUTION_LOCK_BUCKETS = 64

function contributionLockIds(idUsers: readonly number[]): number[] {
	return sortedUniqueUserIds(
		idUsers.map(
			(idUser) =>
				((idUser % USER_POINT_CONTRIBUTION_LOCK_BUCKETS) +
					USER_POINT_CONTRIBUTION_LOCK_BUCKETS) %
				USER_POINT_CONTRIBUTION_LOCK_BUCKETS,
		),
	)
}

async function acquireUserContributionLocks(
	tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
	idUsers: readonly number[],
): Promise<void> {
	const lockIds = contributionLockIds(idUsers)
	if (lockIds.length === 0) return
	await tx.execute(sql`
		SELECT pg_advisory_xact_lock(
			${USER_POINT_CONTRIBUTION_LOCK_NAMESPACE},
			locked_user.id_user
		)
		FROM unnest(${sql.param(lockIds)}::integer[]) AS locked_user(id_user)
		ORDER BY locked_user.id_user
	`)
}

function chunks<T>(items: T[], size: number): T[][] {
	const result: T[][] = []
	for (let index = 0; index < items.length; index += size) {
		result.push(items.slice(index, index + size))
	}
	return result
}

export async function updateUserPointContributionPlayerValuesBulk(
	entries: UserPointContributionBatchInput[],
): Promise<void> {
	if (entries.length === 0) {
		return
	}

	await db.transaction(async (tx) => {
		const idUsers = sortedUniqueUserIds(entries.map((entry) => entry.idUser))
		await acquireUserContributionLocks(tx, idUsers)
		const rows = entries.flatMap((entry) =>
			entry.contributions.map((contribution) => ({
				idUser: entry.idUser,
				...contribution,
			})),
		)

		for (const batch of chunks(rows, WRITE_BATCH_SIZE)) {
			// Match PostgreSQL's real columns before the optimistic snapshot comparison. A real
			// value read through the text protocol may not equal the same decimal rebound as
			// double precision, even though both round to the same persisted float4 value.
			const values = sql.join(
				batch.map(
					(row) => sql`(
						${row.idUser}::integer,
						${row.idLevel}::integer,
						${row.idRecord}::integer,
						${row.levelPosition}::integer,
						${row.levelPoints}::integer,
						${row.levelDecayedPoints}::real,
						${row.contributionRank}::integer,
						${row.playerDecayedPoints}::real
					)`,
				),
				sql`, `,
			)
			await tx.execute(sql`
				UPDATE ${userPointContribution} AS target
				SET
					contribution_rank = source.contribution_rank,
					player_decayed_points = source.player_decayed_points,
					date_calculated = NOW()
				FROM (VALUES ${values}) AS source(
					id_user,
					id_level,
					id_record,
					level_position,
					level_points,
					level_decayed_points,
					contribution_rank,
					player_decayed_points
				)
				WHERE target.id_user = source.id_user
					AND target.id_level = source.id_level
					AND ROW(
						target.id_record,
						target.level_position,
						target.level_points,
						target.level_decayed_points
					) IS NOT DISTINCT FROM ROW(
						source.id_record,
						source.level_position,
						source.level_points,
						source.level_decayed_points
					)
					AND ROW(
						target.contribution_rank,
						target.player_decayed_points
					) IS DISTINCT FROM ROW(
						source.contribution_rank,
						source.player_decayed_points
					)
			`)
		}
	})
}

export async function syncUserPointContributionLevels(
	idLevels: number[],
): Promise<LevelContributionProjectionSyncResult> {
	const uniqueLevelIds = [...new Set(idLevels)].sort((a, b) => a - b)
	if (uniqueLevelIds.length === 0) {
		return { levels: 0, users: 0 }
	}

	return db.transaction(async (tx) => {
		const affectedUsers = await tx.execute<{ idUser: number }>(sql`
			SELECT DISTINCT affected.id_user AS "idUser"
			FROM (
				SELECT ${personalBestGlobal.idUser} AS id_user
				FROM ${personalBestGlobal}
				WHERE ${personalBestGlobal.idLevel} = ANY(${sql.param(uniqueLevelIds)}::integer[])
				UNION
				SELECT ${userPointContribution.idUser} AS id_user
				FROM ${userPointContribution}
				WHERE ${userPointContribution.idLevel} = ANY(${sql.param(uniqueLevelIds)}::integer[])
			) AS affected
			ORDER BY affected.id_user
		`)
		const idUsers = affectedUsers.map((entry) => entry.idUser)
		await acquireUserContributionLocks(tx, idUsers)

		await tx.execute(sql`
			WITH ranked_personal_bests AS (
				SELECT
					${personalBestGlobal.idUser} AS id_user,
					${personalBestGlobal.idLevel} AS id_level,
					${personalBestGlobal.idRecord} AS id_record,
					${levelPoints.points} AS level_points,
					(
						RANK() OVER (
							PARTITION BY ${personalBestGlobal.idLevel}
							ORDER BY ${record.time}
						)
					)::integer AS level_position
				FROM ${personalBestGlobal}
				INNER JOIN ${record} ON ${record.id} = ${personalBestGlobal.idRecord}
				INNER JOIN ${levelPoints} ON ${levelPoints.idLevel} = ${personalBestGlobal.idLevel}
				WHERE ${personalBestGlobal.idLevel} = ANY(${sql.param(uniqueLevelIds)}::integer[])
					AND ${levelPoints.points} > 0
			), desired AS (
				SELECT
					ranked_personal_bests.*,
					CASE
						WHEN LN(ranked_personal_bests.level_points::double precision)
							+ (ranked_personal_bests.level_position - 1)
								* LN(${LEVEL_DECAY_FACTOR}::double precision)
							< LN(${MIN_PERSISTED_DECAYED_POINTS}::double precision)
							THEN 0::double precision
						ELSE ranked_personal_bests.level_points::double precision * POWER(
							${LEVEL_DECAY_FACTOR}::double precision,
							ranked_personal_bests.level_position - 1
						)
					END AS level_decayed_points
				FROM ranked_personal_bests
			)
			INSERT INTO ${userPointContribution} (
				id_user,
				id_level,
				id_record,
				contribution_rank,
				level_position,
				level_points,
				level_decayed_points,
				player_decayed_points,
				date_calculated
			)
			SELECT
				desired.id_user,
				desired.id_level,
				desired.id_record,
				COALESCE(existing.contribution_rank, 2147483647),
				desired.level_position,
				desired.level_points,
				desired.level_decayed_points,
				COALESCE(existing.player_decayed_points, 0::double precision),
				NOW()
			FROM desired
			LEFT JOIN ${userPointContribution} AS existing
				ON existing.id_user = desired.id_user
				AND existing.id_level = desired.id_level
			ON CONFLICT (id_user, id_level) DO UPDATE SET
				id_record = EXCLUDED.id_record,
				level_position = EXCLUDED.level_position,
				level_points = EXCLUDED.level_points,
				level_decayed_points = EXCLUDED.level_decayed_points,
				date_calculated = EXCLUDED.date_calculated
			WHERE ROW(
				${userPointContribution.idRecord},
				${userPointContribution.levelPosition},
				${userPointContribution.levelPoints},
				${userPointContribution.levelDecayedPoints}
			) IS DISTINCT FROM ROW(
				EXCLUDED.id_record,
				EXCLUDED.level_position,
				EXCLUDED.level_points,
				EXCLUDED.level_decayed_points
			)
		`)

		await tx.execute(sql`
			DELETE FROM ${userPointContribution} AS contribution
			WHERE contribution.id_level = ANY(${sql.param(uniqueLevelIds)}::integer[])
				AND NOT EXISTS (
					SELECT 1
					FROM ${personalBestGlobal}
					INNER JOIN ${levelPoints}
						ON ${levelPoints.idLevel} = ${personalBestGlobal.idLevel}
					WHERE ${personalBestGlobal.idUser} = contribution.id_user
						AND ${personalBestGlobal.idLevel} = contribution.id_level
						AND ${personalBestGlobal.idRecord} = contribution.id_record
						AND ${levelPoints.points} > 0
				)
		`)

		return { levels: uniqueLevelIds.length, users: idUsers.length }
	})
}

export async function getUserPointContributionsForUsers(
	idUsers: number[],
): Promise<Map<number, Omit<UserPointContributionInput, 'idUser'>[]>> {
	if (idUsers.length === 0) {
		return new Map()
	}

	const rows = await db
		.select({
			idUser: userPointContribution.idUser,
			idLevel: userPointContribution.idLevel,
			idRecord: userPointContribution.idRecord,
			contributionRank: userPointContribution.contributionRank,
			levelPosition: userPointContribution.levelPosition,
			levelPoints: userPointContribution.levelPoints,
			levelDecayedPoints: userPointContribution.levelDecayedPoints,
			playerDecayedPoints: userPointContribution.playerDecayedPoints,
		})
		.from(userPointContribution)
		.where(inArray(userPointContribution.idUser, idUsers))
		.orderBy(asc(userPointContribution.idUser), asc(userPointContribution.contributionRank))

	const grouped = new Map<number, Omit<UserPointContributionInput, 'idUser'>[]>()
	for (const row of rows) {
		const { idUser, ...contribution } = row
		const entries = grouped.get(idUser) ?? []
		entries.push(contribution)
		grouped.set(idUser, entries)
	}
	return grouped
}

export async function getUserPointContributions(idUser: number) {
	return db
		.select()
		.from(userPointContribution)
		.where(eq(userPointContribution.idUser, idUser))
		.orderBy(asc(userPointContribution.contributionRank))
}
