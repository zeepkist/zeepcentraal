import { beforeEach, expect, mock, test } from 'bun:test'

const getPersonalBestCount90thPercentile = mock(async () => 100)
const updateLevelScoreBatch = mock(async () => ({ updated: 1, zeroed: 0, reported: 0 }))

mock.module('@zeepkist/database', () => ({ getPersonalBestCount90thPercentile }))
mock.module('./levelScoreBatch', () => ({ updateLevelScoreBatch }))

const { updateLevelScore } = await import('./updateLevelScore')

beforeEach(() => {
	getPersonalBestCount90thPercentile.mockClear()
	updateLevelScoreBatch.mockClear()
})

test('queues submitting player after contribution projection sync', async () => {
	const events: string[] = []
	updateLevelScoreBatch.mockImplementationOnce(async () => {
		events.push('level-projection')
		return { updated: 1, zeroed: 0, reported: 0 }
	})
	const addJob = mock(async () => {
		events.push('player-job')
	})

	await updateLevelScore({ idLevel: 7, idUser: 42 }, {
		addJob,
		logger: { info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(events).toEqual(['level-projection', 'player-job'])
	expect(addJob).toHaveBeenCalledWith(
		'updatePlayerScore',
		{ idUser: 42 },
		{
			jobKey: 'update-player-score:42',
			queueName: 'player-score-writes',
		},
	)
})

test('report-only level scoring does not queue player mutation', async () => {
	const addJob = mock(async () => {})

	await updateLevelScore({ idLevel: 7, idUser: 42, reportOnly: true }, {
		addJob,
		logger: { info: mock(() => {}), warn: mock(() => {}) },
	} as never)

	expect(addJob).not.toHaveBeenCalled()
})
