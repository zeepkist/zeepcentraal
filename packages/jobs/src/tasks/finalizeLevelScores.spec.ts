import { beforeEach, expect, mock, test } from 'bun:test'

const syncChangedLevelPointContributionValues = mock(async () => ({
	deleted: 2,
	fallbackLevels: 1,
	updated: 30,
	users: 12,
}))
const syncUserPointContributionLevels = mock(async () => ({ levels: 2, users: 4 }))

mock.module('@zeepkist/database', () => ({
	syncChangedLevelPointContributionValues,
	syncUserPointContributionLevels,
}))

const { finalizeLevelScores } = await import('./finalizeLevelScores')

beforeEach(() => {
	syncChangedLevelPointContributionValues.mockClear()
	syncUserPointContributionLevels.mockClear()
})

test('full run applies point deltas then queues player score refresh', async () => {
	const addJob = mock(async () => {})
	const runId = crypto.randomUUID()

	await finalizeLevelScores({ all: true, runId }, {
		addJob,
		logger: { info: mock(() => {}) },
	} as never)

	expect(syncChangedLevelPointContributionValues).toHaveBeenCalledTimes(1)
	expect(syncUserPointContributionLevels).not.toHaveBeenCalled()
	expect(addJob).toHaveBeenCalledWith(
		'updatePlayerScores',
		{},
		{
			jobKey: 'update-player-scores',
			jobKeyMode: 'unsafe_dedupe',
			queueName: 'player-score-writes',
		},
	)
})

test('incremental run projects all changed levels once', async () => {
	await finalizeLevelScores({ all: false, ids: [2, 3], runId: crypto.randomUUID() }, {
		addJob: mock(async () => {}),
		logger: { info: mock(() => {}) },
	} as never)

	expect(syncUserPointContributionLevels).toHaveBeenCalledWith([2, 3])
	expect(syncChangedLevelPointContributionValues).not.toHaveBeenCalled()
})
