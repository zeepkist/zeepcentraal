import { sql } from 'drizzle-orm'
import { arrayParam } from '../arrayParam'
import type { DatabaseTransaction } from '../client'
import { sortedUniqueUserIds } from './userPointContributionHelpers'

// Negative namespace cannot collide with record submission's positive (user,level) keys.
export async function lockUserScores(tx: DatabaseTransaction, ids: number[]) {
	const sorted = sortedUniqueUserIds(ids)
	if (!sorted.length) return
	await tx.execute(sql`SELECT pg_advisory_xact_lock(-1861284952, target.id)
  FROM UNNEST(${arrayParam(sorted)}::integer[]) AS target(id) ORDER BY target.id`)
}
