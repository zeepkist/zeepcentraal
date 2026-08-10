import { beforeEach, expect, mock, test } from 'bun:test'

const getAllLevelIds = mock(async () => [1, 2])
const getAllLevelIdsWithRecordsSince = mock(async (_recordsSince: Date) => [2])
const getPersonalBestCount90thPercentile = mock(async () => 100)
const rebuildPlayerSkillAggregates = mock(async () => 50)

mock.module('@zeepkist/database', () => ({
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	getPersonalBestCount90thPercentile,
	rebuildPlayerSkillAggregates,
}))

const { RECENT_LEVEL_SCORE_LOOKBACK_MS, updateLevelScores } = await import('./updateLevelScores')

beforeEach(() => {
	getAllLevelIds.mockClear()
	getAllLevelIdsWithRecordsSince.mockClear()
	getPersonalBestCount90thPercentile.mockClear()
	rebuildPlayerSkillAggregates.mockClear()
})

test('rebuilds independent skill before full level scoring', async () => {
	const addJobs = mock(async () => {})
	const info = mock(() => {})

	await updateLevelScores({ all: true }, { addJobs, logger: { info } } as never)

	expect(rebuildPlayerSkillAggregates).toHaveBeenCalledTimes(1)
	expect(getAllLevelIds).toHaveBeenCalledTimes(1)
	expect(addJobs).toHaveBeenCalledTimes(1)
	expect(info).toHaveBeenCalledWith('Rebuilt independent player skill for 50 players.')
})

test('reuses skill snapshot for incremental scoring', async () => {
	const addJobs = mock(async () => {})
	const before = Date.now()

	await updateLevelScores({ all: false }, { addJobs, logger: { info: mock(() => {}) } } as never)
	const after = Date.now()

	expect(rebuildPlayerSkillAggregates).not.toHaveBeenCalled()
	expect(getAllLevelIdsWithRecordsSince).toHaveBeenCalledTimes(1)
	const cutoff = getAllLevelIdsWithRecordsSince.mock.calls[0]?.[0]
	expect(cutoff).toBeInstanceOf(Date)
	expect(cutoff?.getTime()).toBeGreaterThanOrEqual(before - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	expect(cutoff?.getTime()).toBeLessThanOrEqual(after - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	expect(addJobs).toHaveBeenCalledTimes(1)
})
