import { beforeEach, expect, mock, test } from 'bun:test'

const syncChangedLevelPointContributionValues = mock(async () => ({
	deleted: 2,
	fallbackLevels: 1,
	updated: 30,
	users: 12,
}))
const syncUserPointContributionLevels = mock(async () => ({
	idUsers: [1, 2, 3, 4],
	levels: 2,
	users: 4,
}))

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
	const info = mock((_message: string, _metadata?: unknown) => {})
	const logger = {
		debug: mock(() => {}),
		error: mock(() => {}),
		info,
		warn: mock(() => {}),
	}
	const runId = crypto.randomUUID()

	await finalizeLevelScores({ all: true, runId }, {
		addJob,
		logger,
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
	expect(info).toHaveBeenCalledWith(
		expect.stringContaining(
			`run=${runId} mode=delta updated=30 deleted=2 fallbackLevels=1 users=12`,
		),
		expect.objectContaining({
			all: true,
			deleted: 2,
			fallbackLevels: 1,
			updated: 30,
			users: 12,
		}),
	)
})

test('incremental run projects all changed levels once', async () => {
	const info = mock((_message: string, _metadata?: unknown) => {})
	const logger = {
		debug: mock(() => {}),
		error: mock(() => {}),
		info,
		warn: mock(() => {}),
	}
	await finalizeLevelScores({ all: false, ids: [2, 3], runId: crypto.randomUUID() }, {
		addJob: mock(async () => {}),
		logger,
	} as never)

	expect(syncUserPointContributionLevels).toHaveBeenCalledWith(
		[2, 3],
		expect.objectContaining({ runPhase: expect.any(Function) }),
	)
	expect(syncChangedLevelPointContributionValues).not.toHaveBeenCalled()
	expect(
		info.mock.calls.some(([message]) => message.includes('mode=projection levels=2 users=4')),
	).toBe(true)
})
