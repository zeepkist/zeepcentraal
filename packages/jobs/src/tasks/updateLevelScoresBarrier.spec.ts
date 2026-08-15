import { expect, mock, test } from 'bun:test'
import { updateLevelScoresBarrier } from './updateLevelScoresBarrier'

test('chains queue barriers then queues serialized finalizer', async () => {
	const addJob = mock(async () => {})
	const logger = { info: mock(() => {}) }
	const payload = {
		all: false,
		ids: [1, 2],
		phase: 'queue0' as const,
		runId: crypto.randomUUID(),
	}

	await updateLevelScoresBarrier(payload, { addJob, logger } as never)
	expect(addJob).toHaveBeenCalledWith(
		'updateLevelScoresBarrier',
		{ ...payload, phase: 'queue1' },
		{
			jobKey: `update-level-scores-barrier:${payload.runId}:queue1`,
			priority: 0,
			queueName: 'level-score-batch-1',
		},
	)

	addJob.mockClear()
	await updateLevelScoresBarrier({ ...payload, phase: 'queue1' }, { addJob, logger } as never)
	expect(addJob).toHaveBeenCalledWith(
		'finalizeLevelScores',
		{ all: false, ids: [1, 2], runId: payload.runId },
		{
			jobKey: `finalize-level-scores:${payload.runId}`,
			priority: 0,
			queueName: 'player-score-writes',
		},
	)
})
