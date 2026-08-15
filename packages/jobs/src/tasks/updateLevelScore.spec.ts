import { beforeEach, expect, mock, test } from 'bun:test'

const updateLevelScoreBatch = mock(async () => ({
	affectedUserIds: [42],
	updated: 1,
	zeroed: 0,
	reported: 0,
}))

mock.module('./levelScoreBatch', () => ({ updateLevelScoreBatch }))

const { updateLevelScore } = await import('./updateLevelScore')

beforeEach(() => {
	updateLevelScoreBatch.mockClear()
})

test('queues submitting player after contribution projection sync', async () => {
	const events: string[] = []
	updateLevelScoreBatch.mockImplementationOnce(async () => {
		events.push('level-projection')
		return { affectedUserIds: [42, 99], updated: 1, zeroed: 0, reported: 0 }
	})
	const addJobs = mock(async () => {
		events.push('player-job')
	})

	await updateLevelScore({ idLevel: 7, idUser: 42 }, {
		addJobs,
		logger: { info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(events).toEqual(['level-projection', 'player-job'])
	expect(addJobs).toHaveBeenCalledWith([
		{
			identifier: 'updatePlayerScore',
			payload: { idUser: 42 },
			jobKey: 'update-player-score:42',
			queueName: 'player-score-writes',
		},
		{
			identifier: 'updatePlayerScore',
			payload: { idUser: 99 },
			jobKey: 'update-player-score:99',
			queueName: 'player-score-writes',
		},
	])
})

test('report-only level scoring does not queue player mutation', async () => {
	const addJobs = mock(async () => {})

	await updateLevelScore({ idLevel: 7, idUser: 42, reportOnly: true }, {
		addJobs,
		logger: { info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(addJobs).not.toHaveBeenCalled()
})
