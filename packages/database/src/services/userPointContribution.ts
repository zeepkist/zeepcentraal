import { asc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { userPointContribution } from '../schema'
import {
	sortedUniqueUserIds,
	userPointContributionFingerprint,
} from './userPointContributionHelpers'

export {
	sortedUniqueUserIds,
	userPointContributionFingerprint,
} from './userPointContributionHelpers'

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

// Nine bound values per contribution; 5,000 stays below PostgreSQL's parameter limit.
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

export async function upsertUserPointContributionsBulk(
	entries: UserPointContributionBatchInput[],
): Promise<void> {
	if (entries.length === 0) {
		return
	}

	await db.transaction(async (tx) => {
		const idUsers = sortedUniqueUserIds(entries.map((entry) => entry.idUser))
		await acquireUserContributionLocks(tx, idUsers)

		const existingRows = await tx
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

		const existingByUser = new Map<number, Omit<UserPointContributionInput, 'idUser'>[]>()
		for (const row of existingRows) {
			const rows = existingByUser.get(row.idUser) ?? []
			rows.push({
				idLevel: row.idLevel,
				idRecord: row.idRecord,
				contributionRank: row.contributionRank,
				levelPosition: row.levelPosition,
				levelPoints: row.levelPoints,
				levelDecayedPoints: row.levelDecayedPoints,
				playerDecayedPoints: row.playerDecayedPoints,
			})
			existingByUser.set(row.idUser, rows)
		}

		const changedEntries = entries.filter(
			(entry) =>
				userPointContributionFingerprint(existingByUser.get(entry.idUser) ?? []) !==
				userPointContributionFingerprint(entry.contributions),
		)
		if (changedEntries.length === 0) return

		const changedUserIds = new Set(changedEntries.map((entry) => entry.idUser))
		const desiredKeys = new Set(
			changedEntries.flatMap((entry) =>
				entry.contributions.map(
					(contribution) => `${entry.idUser}:${contribution.idLevel}`,
				),
			),
		)
		const removedRows = existingRows.filter(
			(row) =>
				changedUserIds.has(row.idUser) && !desiredKeys.has(`${row.idUser}:${row.idLevel}`),
		)
		const now = new Date().toISOString()
		const rows = changedEntries.flatMap((entry) =>
			entry.contributions.map((contribution) => ({
				idUser: entry.idUser,
				...contribution,
				dateCalculated: now,
			})),
		)

		for (const batch of chunks(rows, WRITE_BATCH_SIZE)) {
			await tx
				.insert(userPointContribution)
				.values(batch)
				.onConflictDoUpdate({
					target: [userPointContribution.idUser, userPointContribution.idLevel],
					set: {
						idRecord: sql`EXCLUDED.id_record`,
						contributionRank: sql`EXCLUDED.contribution_rank`,
						levelPosition: sql`EXCLUDED.level_position`,
						levelPoints: sql`EXCLUDED.level_points`,
						levelDecayedPoints: sql`EXCLUDED.level_decayed_points`,
						playerDecayedPoints: sql`EXCLUDED.player_decayed_points`,
						dateCalculated: sql`EXCLUDED.date_calculated`,
					},
					where: sql`ROW(
						${userPointContribution.idRecord},
						${userPointContribution.contributionRank},
						${userPointContribution.levelPosition},
						${userPointContribution.levelPoints},
						${userPointContribution.levelDecayedPoints},
						${userPointContribution.playerDecayedPoints}
					) IS DISTINCT FROM ROW(
						EXCLUDED.id_record,
						EXCLUDED.contribution_rank,
						EXCLUDED.level_position,
						EXCLUDED.level_points,
						EXCLUDED.level_decayed_points,
						EXCLUDED.player_decayed_points
					)`,
				})
		}

		for (const batch of chunks(removedRows, WRITE_BATCH_SIZE)) {
			const keys = sql.join(
				batch.map((row) => sql`(${row.idUser}::integer, ${row.idLevel}::integer)`),
				sql`, `,
			)
			await tx.delete(userPointContribution).where(sql`
				(${userPointContribution.idUser}, ${userPointContribution.idLevel}) IN (${keys})
			`)
		}
	})
}

export async function clearUserPointContributions(idUsers: number[]): Promise<void> {
	if (idUsers.length === 0) {
		return
	}
	await db.transaction(async (tx) => {
		const lockIds = sortedUniqueUserIds(idUsers)
		await acquireUserContributionLocks(tx, lockIds)
		await tx.delete(userPointContribution).where(inArray(userPointContribution.idUser, lockIds))
	})
}

export async function getUserPointContributions(idUser: number) {
	return db
		.select()
		.from(userPointContribution)
		.where(eq(userPointContribution.idUser, idUser))
		.orderBy(asc(userPointContribution.contributionRank))
}
