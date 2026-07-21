import { beforeEach, expect, mock, test } from 'bun:test'

let recoveredRows: Array<{ lockedAt: string; lockedBy: string; queueName: string }> = []
const unsafe = mock(async () => recoveredRows)

mock.module('@zeepkist/database', () => ({ client: { unsafe } }))

const { recoverOrphanedPlayerScoreQueueLock, RECOVER_ORPHANED_PLAYER_SCORE_QUEUE_LOCK_SQL } =
	await import('./recoverOrphanedPlayerScoreQueueLock')

beforeEach(() => {
	recoveredRows = []
	unsafe.mockClear()
})

test('recovers only queue locks without matching locked jobs', async () => {
	recoveredRows = [
		{
			queueName: 'player-score-writes',
			lockedAt: '2026-07-21T21:27:00.000Z',
			lockedBy: 'pool-dead',
		},
	]

	await expect(recoverOrphanedPlayerScoreQueueLock()).resolves.toEqual(recoveredRows)
	expect(unsafe).toHaveBeenCalledTimes(1)
	expect(RECOVER_ORPHANED_PLAYER_SCORE_QUEUE_LOCK_SQL).toContain('AND NOT EXISTS')
	expect(RECOVER_ORPHANED_PLAYER_SCORE_QUEUE_LOCK_SQL).toContain(
		'job.locked_by = queue.locked_by',
	)
	expect(RECOVER_ORPHANED_PLAYER_SCORE_QUEUE_LOCK_SQL).toContain(
		'queue.locked_by = orphaned.locked_by',
	)
})

test('is a no-op when queue is unlocked or has a matching active job', async () => {
	await expect(recoverOrphanedPlayerScoreQueueLock()).resolves.toEqual([])
	await expect(recoverOrphanedPlayerScoreQueueLock()).resolves.toEqual([])
	expect(unsafe).toHaveBeenCalledTimes(2)
})
