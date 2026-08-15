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
	const addJobs = mock(async (_jobs: unknown[]) => {})
	const addJob = mock(async (_identifier: string, _payload: unknown, _spec: unknown) => {})
	const info = mock(() => {})

	await updateLevelScores({ all: true }, { addJob, addJobs, logger: { info } } as never)

	expect(rebuildPlayerSkillAggregates).toHaveBeenCalledTimes(1)
	expect(getAllLevelIds).toHaveBeenCalledTimes(1)
	expect(addJobs).toHaveBeenCalledTimes(1)
	const batchJobs = addJobs.mock.calls[0]?.[0] as Array<{
		payload: { runId: string }
	}>
	const runId = batchJobs[0]?.payload.runId
	expect(runId).toEqual(expect.any(String))
	expect(batchJobs.every((job) => job.payload.runId === runId)).toBe(true)
	expect(addJob).toHaveBeenCalledWith(
		'monitorLevelScoreRun',
		{ all: true, check: 0, runId },
		expect.objectContaining({
			jobKey: `monitor-level-score-run:${runId}:0`,
			priority: 5,
			queueName: 'level-score-run-monitor',
		}),
	)
	expect(info).toHaveBeenCalledWith('Rebuilt independent player skill for 50 players.')
})

test('reuses skill snapshot for incremental scoring', async () => {
	const addJobs = mock(async (_jobs: unknown[]) => {})
	const addJob = mock(async (_identifier: string, _payload: unknown, _spec: unknown) => {})
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
	const batchJobs = addJobs.mock.calls[0]?.[0] as Array<{
		payload: { runId: string }
	}>
	const runId = batchJobs[0]?.payload.runId
	expect(addJob).toHaveBeenCalledWith(
		'monitorLevelScoreRun',
		{ all: false, check: 0, ids: [2], runId },
		expect.objectContaining({
			jobKey: `monitor-level-score-run:${runId}:0`,
			priority: 0,
			queueName: 'level-score-run-monitor',
		}),
	)
})

test('report-only scoring does not queue finalization', async () => {
	const addJobs = mock(async (_jobs: unknown[]) => {})
	const addJob = mock(async (_identifier: string, _payload: unknown, _spec: unknown) => {})

	await updateLevelScores({ all: true, reportOnly: true }, {
		addJob,
		addJobs,
		logger: { info: mock(() => {}) },
	} as never)

	expect(addJobs).toHaveBeenCalledTimes(1)
	const batchJobs = addJobs.mock.calls[0]?.[0] as Array<{
		payload: { reportOnly: boolean; runId: string }
	}>
	expect(batchJobs.every((job) => job.payload.reportOnly && job.payload.runId.length > 0)).toBe(
		true,
	)
	expect(addJob).not.toHaveBeenCalled()
})
