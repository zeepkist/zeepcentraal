import { beforeEach, expect, mock, test } from 'bun:test'

const getAllLevelIds = mock(async () => [1, 2])
const getAllLevelIdsWithRecordsSince = mock(async (_recordsSince: Date) => [2])
const rebuildPlayerSkillAggregates = mock(async () => 50)

mock.module('@zeepkist/database', () => ({
	getAllLevelIds,
	getAllLevelIdsWithRecordsSince,
	rebuildPlayerSkillAggregates,
}))

const { RECENT_LEVEL_SCORE_LOOKBACK_MS, updateLevelScores } = await import('./updateLevelScores')

beforeEach(() => {
	getAllLevelIds.mockClear()
	getAllLevelIdsWithRecordsSince.mockClear()
	rebuildPlayerSkillAggregates.mockClear()
})

test('rebuilds independent skill before full level scoring', async () => {
	const addJobs = mock(async () => {})
	const addJob = mock(async () => {})
	const info = mock(() => {})

	await updateLevelScores({ all: true }, { addJob, addJobs, logger: { info } } as never)

	expect(rebuildPlayerSkillAggregates).toHaveBeenCalledTimes(1)
	expect(getAllLevelIds).toHaveBeenCalledTimes(1)
	expect(addJobs).toHaveBeenCalledTimes(1)
	expect(addJob).toHaveBeenCalledWith(
		'updateLevelScoresBarrier',
		expect.objectContaining({ all: true, phase: 'queue0', runId: expect.any(String) }),
		expect.objectContaining({ priority: 5, queueName: 'level-score-batch-0' }),
	)
	expect(info).toHaveBeenCalledWith('Rebuilt independent player skill for 50 players.')
})

test('reuses skill snapshot for incremental scoring', async () => {
	const addJobs = mock(async () => {})
	const addJob = mock(async () => {})
	const before = Date.now()

	await updateLevelScores({ all: false }, {
		addJob,
		addJobs,
		logger: { info: mock(() => {}) },
	} as never)
	const after = Date.now()

	expect(rebuildPlayerSkillAggregates).not.toHaveBeenCalled()
	expect(getAllLevelIdsWithRecordsSince).toHaveBeenCalledTimes(1)
	const cutoff = getAllLevelIdsWithRecordsSince.mock.calls[0]?.[0]
	expect(cutoff).toBeInstanceOf(Date)
	expect(cutoff?.getTime()).toBeGreaterThanOrEqual(before - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	expect(cutoff?.getTime()).toBeLessThanOrEqual(after - RECENT_LEVEL_SCORE_LOOKBACK_MS)
	expect(addJobs).toHaveBeenCalledTimes(1)
	expect(addJob).toHaveBeenCalledWith(
		'updateLevelScoresBarrier',
		expect.objectContaining({ all: false, ids: [2], phase: 'queue0' }),
		expect.objectContaining({ priority: 0, queueName: 'level-score-batch-0' }),
	)
})

test('report-only scoring does not queue finalization', async () => {
	const addJobs = mock(async () => {})
	const addJob = mock(async () => {})

	await updateLevelScores({ all: true, reportOnly: true }, {
		addJob,
		addJobs,
		logger: { info: mock(() => {}) },
	} as never)

	expect(addJobs).toHaveBeenCalledTimes(1)
	expect(addJob).not.toHaveBeenCalled()
})
