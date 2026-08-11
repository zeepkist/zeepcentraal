import { sql } from 'drizzle-orm'
import type { db } from '../client'

export const USER_POINT_CONTRIBUTION_LOCK_NAMESPACE = 1_516_438_864
export const USER_POINT_CONTRIBUTION_LOCK_BUCKETS = 64

export function sortedUniqueUserIds(idUsers: readonly number[]): number[] {
	return [...new Set(idUsers)].toSorted((left, right) => left - right)
}

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

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0]

export async function acquireUserContributionLocks(
	tx: DatabaseTransaction,
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
