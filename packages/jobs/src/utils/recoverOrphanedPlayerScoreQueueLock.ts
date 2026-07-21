import { client } from '@zeepkist/database'
import { PLAYER_SCORE_QUEUE_NAME } from './playerScoreJobOptions'

export interface RecoveredPlayerScoreQueueLock {
	lockedAt: Date | string
	lockedBy: string
	queueName: string
}

export const RECOVER_ORPHANED_PLAYER_SCORE_QUEUE_LOCK_SQL = `
	WITH orphaned AS (
		SELECT queue.id, queue.queue_name, queue.locked_at, queue.locked_by
		FROM graphile_worker._private_job_queues AS queue
		WHERE queue.queue_name = $1
			AND queue.locked_at IS NOT NULL
			AND queue.locked_by IS NOT NULL
			AND NOT EXISTS (
				SELECT 1
				FROM graphile_worker._private_jobs AS job
				WHERE job.job_queue_id = queue.id
					AND job.locked_by = queue.locked_by
			)
		FOR UPDATE
	), recovered AS (
		UPDATE graphile_worker._private_job_queues AS queue
		SET locked_at = NULL, locked_by = NULL
		FROM orphaned
		WHERE queue.id = orphaned.id
			AND queue.locked_by = orphaned.locked_by
		RETURNING orphaned.queue_name, orphaned.locked_at, orphaned.locked_by
	)
	SELECT
		queue_name AS "queueName",
		locked_at AS "lockedAt",
		locked_by AS "lockedBy"
	FROM recovered
`

export async function recoverOrphanedPlayerScoreQueueLock(): Promise<
	RecoveredPlayerScoreQueueLock[]
> {
	return client.unsafe(RECOVER_ORPHANED_PLAYER_SCORE_QUEUE_LOCK_SQL, [PLAYER_SCORE_QUEUE_NAME])
}
