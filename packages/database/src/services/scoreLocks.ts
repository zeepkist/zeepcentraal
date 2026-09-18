import { sql } from 'drizzle-orm'
import { arrayParam } from '../arrayParam'
import type { DatabaseTransaction } from '../client'
import { sortedUniqueUserIds } from './userPointContributionHelpers'

// Keep scoring coordination separate from record/tournament level coordination.
export const LEVEL_SCORE_LOCK_NAMESPACE = 1_861_284_954
export const WORLD_RECORD_LOCK_NAMESPACE = 1_861_284_953
export const USER_SCORE_LOCK_NAMESPACE = -1_861_284_952
export const WORLD_RECORD_COUNT_LOCK_NAMESPACE = 1_861_284_951

export async function lockLevelScores(tx: DatabaseTransaction, ids: number[]) {
	const sorted = [...new Set(ids)].sort((left, right) => left - right)
	if (!sorted.length) return
	await tx.execute(sql`SELECT pg_advisory_xact_lock(${LEVEL_SCORE_LOCK_NAMESPACE}, target.id)
  FROM UNNEST(${arrayParam(sorted)}::integer[]) AS target(id) ORDER BY target.id`)
}

// Negative namespace cannot collide with record submission's positive (user,level) keys.
export async function lockUserScores(tx: DatabaseTransaction, ids: number[]) {
	const sorted = sortedUniqueUserIds(ids)
	if (!sorted.length) return
	await tx.execute(sql`SELECT pg_advisory_xact_lock(${USER_SCORE_LOCK_NAMESPACE}, target.id)
  FROM UNNEST(${arrayParam(sorted)}::integer[]) AS target(id) ORDER BY target.id`)
}

export async function lockWorldRecords(tx: DatabaseTransaction, ids: number[]) {
	const sorted = [...new Set(ids)].sort((left, right) => left - right)
	if (!sorted.length) return
	await tx.execute(sql`SELECT pg_advisory_xact_lock(${WORLD_RECORD_LOCK_NAMESPACE}, target.id)
  FROM UNNEST(${arrayParam(sorted)}::integer[]) AS target(id) ORDER BY target.id`)
}

export async function lockWorldRecordCounts(tx: DatabaseTransaction, ids: number[]) {
	const sorted = sortedUniqueUserIds(ids)
	if (!sorted.length) return
	await tx.execute(sql`SELECT pg_advisory_xact_lock(${WORLD_RECORD_COUNT_LOCK_NAMESPACE}, target.id)
  FROM UNNEST(${arrayParam(sorted)}::integer[]) AS target(id) ORDER BY target.id`)
}
