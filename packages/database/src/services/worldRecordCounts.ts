import { sql } from 'drizzle-orm'
import { arrayParam } from '../arrayParam'
import type { DatabaseTransaction } from '../client'
import { userPoints, worldRecordGlobal } from '../schema'
import { sortedUniqueUserIds } from './userPointContributionHelpers'

export async function refreshUserWorldRecordCounts(
	tx: DatabaseTransaction,
	idUsers: number[],
): Promise<void> {
	const sorted = sortedUniqueUserIds(idUsers)
	if (!sorted.length) return

	await tx.execute(sql`
		INSERT INTO ${userPoints} (id_user, world_records, date_updated)
		SELECT target.id, (
			SELECT COUNT(*)::integer
			FROM ${worldRecordGlobal}
			WHERE ${worldRecordGlobal.idUser} = target.id
		), NOW()
		FROM UNNEST(${arrayParam(sorted)}::integer[]) AS target(id)
		ORDER BY target.id
		ON CONFLICT (id_user) DO UPDATE SET
			world_records = EXCLUDED.world_records,
			date_updated = EXCLUDED.date_updated
		WHERE ${userPoints.worldRecords} IS DISTINCT FROM EXCLUDED.world_records
	`)
}
