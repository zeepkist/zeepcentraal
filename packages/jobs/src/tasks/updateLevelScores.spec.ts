import { beforeEach, expect, mock, test } from 'bun:test'

let allLevelIds = [1, 2]
let recentLevelIds = [2]
const getAllLevelIds = mock(async () => allLevelIds)
const getAllLevelIdsWithRecordsSince = mock(async (_recordsSince: Date) => recentLevelIds)
const rebuildPlayerSkillAggregates = mock(async () => 50)
const updateLevelScoreBatch = mock(async ({ idLevels }: { idLevels: number[] }) => ({
	affectedUserIds: idLevels,
	reported: 0,
	updated: idLevels.length,
	zeroed: 0,
}))

mock.module('@zeepkist/database', () => ({
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	rebuildPlayerSkillAggregates,
}))
mock.module('./levelScoreBatch', () => ({ updateLevelScoreBatch }))

const { LEVEL_SCORE_BATCH_SIZE, RECENT_LEVEL_SCORE_LOOKBACK_MS, updateLevelScores } = await import(
	'./updateLevelScores'
)

function createHelpers() {
	return {
		addJob: mock(async () => {}),
		logger: { info: mock((_message: string, _metadata?: unknown) => {}) },
	}
}

beforeEach(() => {
	allLevelIds = [1, 2]
	recentLevelIds = [2]
	getAllLevelIds.mockClear()
	getAllLevelIdsWithRecordsSince.mockClear()
	rebuildPlayerSkillAggregates.mockClear()
	updateLevelScoreBatch.mockClear()
	updateLevelScoreBatch.mockImplementation(async ({ idLevels }: { idLevels: number[] }) => ({
		affectedUserIds: idLevels,
		reported: 0,
		updated: idLevels.length,
		zeroed: 0,
	}))
})

test('rebuilds independent skill and queues one player refresh after full scoring', async () => {
	const helpers = createHelpers()

	await updateLevelScores({ all: true }, helpers as never)

	expect(rebuildPlayerSkillAggregates).toHaveBeenCalledTimes(1)
	expect(getAllLevelIds).toHaveBeenCalledTimes(1)
	expect(updateLevelScoreBatch).toHaveBeenCalledWith({
		idLevels: [1, 2],
		logger: helpers.logger,
		reportOnly: undefined,
	})
	expect(helpers.addJob).toHaveBeenCalledWith(
		'updatePlayerScores',
		{},
		{
			jobKey: 'update-player-scores',
			queueName: 'player-score-writes',
		},
	)
	expect(helpers.logger.info).toHaveBeenCalledWith(
		'Rebuilt independent player skill for 50 players.',
	)
})

test('processes levels sequentially in batches of 50 with progress metadata', async () => {
	allLevelIds = Array.from({ length: 101 }, (_, index) => index + 1)
	const helpers = createHelpers()

	await updateLevelScores({ all: true }, helpers as never)

	expect(LEVEL_SCORE_BATCH_SIZE).toBe(50)
	expect(updateLevelScoreBatch.mock.calls.map(([input]) => input.idLevels.length)).toEqual([
		50, 50, 1,
	])
	expect(helpers.logger.info).toHaveBeenCalledWith(
		'Completed level score batch 3/3.',
		expect.objectContaining({
			processedLevels: 101,
			progress: 100,
			totalLevels: 101,
		}),
	)
	expect(helpers.addJob).toHaveBeenCalledTimes(1)
})

test('reuses skill snapshot for incremental scoring', async () => {
	const helpers = createHelpers()
	const before = Date.now()

	await updateLevelScores({ all: false }, helpers as never)
	const after = Date.now()

	expect(rebuildPlayerSkillAggregates).not.toHaveBeenCalled()
	expect(getAllLevelIdsWithRecordsSince).toHaveBeenCalledTimes(1)
	const cutoff = getAllLevelIdsWithRecordsSince.mock.calls[0]?.[0]
	expect(cutoff).toBeInstanceOf(Date)
	expect(cutoff?.getTime()).toBeGreaterThanOrEqual(before - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	expect(cutoff?.getTime()).toBeLessThanOrEqual(after - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	expect(updateLevelScoreBatch).toHaveBeenCalledTimes(1)
	expect(helpers.addJob).toHaveBeenCalledTimes(1)
})

test('does not queue player refresh when a level batch fails', async () => {
	allLevelIds = Array.from({ length: 51 }, (_, index) => index + 1)
	updateLevelScoreBatch.mockImplementationOnce(async ({ idLevels }) => ({
		affectedUserIds: idLevels,
		reported: 0,
		updated: idLevels.length,
		zeroed: 0,
	}))
	updateLevelScoreBatch.mockImplementationOnce(async () => {
		throw new Error('projection failed')
	})
	const helpers = createHelpers()

	await expect(updateLevelScores({ all: true }, helpers as never)).rejects.toThrow(
		'projection failed',
	)
	expect(helpers.addJob).not.toHaveBeenCalled()
})

test('report-only scoring calculates batches without queuing player refresh', async () => {
	const helpers = createHelpers()

	await updateLevelScores({ all: true, reportOnly: true }, helpers as never)

	expect(updateLevelScoreBatch).toHaveBeenCalledWith(
		expect.objectContaining({ reportOnly: true }),
	)
	expect(helpers.addJob).not.toHaveBeenCalled()
})
