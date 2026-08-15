import { expect, mock, test } from 'bun:test'
import { LEVEL_SCORE_FINALIZER_PRIORITY } from '../priorities'
import {
	getLevelScoreMonitorRunAt,
	LEVEL_SCORE_MONITOR_MIN_DELAY_MS,
	LEVEL_SCORE_MONITOR_QUEUE_NAME,
	LEVEL_SCORE_MONITOR_RETRY_BUFFER_MS,
	LEVEL_SCORE_RUN_JOBS_SQL,
	type LevelScoreRunJob,
	levelScoreMonitorJobKey,
	monitorLevelScoreRun,
	summarizeLevelScoreRunJobs,
} from './monitorLevelScoreRun'

function job(overrides: Partial<LevelScoreRunJob> = {}): LevelScoreRunJob {
	return {
		attempts: 1,
		id: '100',
		lockedAt: null,
		maxAttempts: 25,
		runAt: new Date('2030-01-01T00:00:00.000Z'),
		...overrides,
	}
}

function helpers(rows: LevelScoreRunJob[]) {
	const query = mock(async (_sql: string, _values: unknown[]) => ({ rows }))
	const withPgClient = mock(
		async (callback: (client: { query: typeof query }) => Promise<unknown>) =>
			callback({ query }),
	)
	const addJob = mock(async (_identifier: string, _payload: unknown, _spec: unknown) => {})
	const error = mock((_message: string, _metadata?: unknown) => {})
	const info = mock((_message: string, _metadata?: unknown) => {})
	return { addJob, error, info, query, withPgClient }
}

test('queries only batch jobs belonging to the monitored run', () => {
	expect(LEVEL_SCORE_RUN_JOBS_SQL).toContain("task.identifier = 'updateLevelScoresBatch'")
	expect(LEVEL_SCORE_RUN_JOBS_SQL).toContain("job.payload ->> 'runId' = $1")
})

test('treats a locked final attempt as pending', () => {
	const status = summarizeLevelScoreRunJobs([
		job({ attempts: 25, lockedAt: new Date(), maxAttempts: 25 }),
	])
	expect(status.pendingCount).toBe(1)
	expect(status.failedJobIds).toEqual([])
})

test('classifies only unlocked exhausted jobs as permanent failures', () => {
	const status = summarizeLevelScoreRunJobs([
		job({ attempts: 25, id: '101', maxAttempts: 25 }),
		job({ attempts: 24, id: '102', maxAttempts: 25 }),
	])
	expect(status.pendingCount).toBe(1)
	expect(status.failedJobIds).toEqual(['101'])
})

test('schedules checks after retry time with a minimum delay', () => {
	const now = Date.parse('2030-01-01T00:00:00.000Z')
	const retry = new Date(now + 10_000)
	expect(getLevelScoreMonitorRunAt(retry, now).getTime()).toBe(
		retry.getTime() + LEVEL_SCORE_MONITOR_RETRY_BUFFER_MS,
	)
	expect(getLevelScoreMonitorRunAt(new Date(now - 10_000), now).getTime()).toBe(
		now + LEVEL_SCORE_MONITOR_MIN_DELAY_MS,
	)
})

test('pending retry queues another monitor instead of finalization', async () => {
	const retry = new Date(Date.now() + 60_000)
	const mocks = helpers([job({ runAt: retry })])
	const runId = crypto.randomUUID()

	await monitorLevelScoreRun({ all: true, check: 2, runId }, {
		addJob: mocks.addJob,
		logger: { error: mocks.error, info: mocks.info },
		withPgClient: mocks.withPgClient,
	} as never)

	expect(mocks.addJob).toHaveBeenCalledWith(
		'monitorLevelScoreRun',
		{ all: true, check: 3, runId },
		expect.objectContaining({
			jobKey: levelScoreMonitorJobKey(runId, 3),
			priority: 5,
			queueName: LEVEL_SCORE_MONITOR_QUEUE_NAME,
			runAt: new Date(retry.getTime() + LEVEL_SCORE_MONITOR_RETRY_BUFFER_MS),
		}),
	)
	expect(mocks.addJob).not.toHaveBeenCalledWith(
		'finalizeLevelScores',
		expect.anything(),
		expect.anything(),
	)
})

test('permanent batch failure aborts without finalization', async () => {
	const mocks = helpers([job({ attempts: 25, id: '422696', maxAttempts: 25 })])
	const runId = crypto.randomUUID()

	await monitorLevelScoreRun({ all: true, check: 4, runId }, {
		addJob: mocks.addJob,
		logger: { error: mocks.error, info: mocks.info },
		withPgClient: mocks.withPgClient,
	} as never)

	expect(mocks.addJob).not.toHaveBeenCalled()
	expect(mocks.error).toHaveBeenCalledWith(
		expect.stringContaining(`run ${runId} aborted`),
		expect.objectContaining({ failedJobIds: ['422696'], pendingCount: 0, runId }),
	)
})

test('completed run queues idempotent priority finalizer', async () => {
	const mocks = helpers([])
	const runId = crypto.randomUUID()
	const payload = { all: false, check: 1, ids: [1, 2], runId }
	const taskHelpers = {
		addJob: mocks.addJob,
		logger: { error: mocks.error, info: mocks.info },
		withPgClient: mocks.withPgClient,
	} as never

	await Promise.all([
		monitorLevelScoreRun(payload, taskHelpers),
		monitorLevelScoreRun(payload, taskHelpers),
	])

	expect(mocks.addJob).toHaveBeenCalledTimes(2)
	for (const call of mocks.addJob.mock.calls) {
		expect(call).toEqual([
			'finalizeLevelScores',
			{ all: false, ids: [1, 2], runId },
			{
				jobKey: `finalize-level-scores:${runId}`,
				jobKeyMode: 'unsafe_dedupe',
				priority: LEVEL_SCORE_FINALIZER_PRIORITY,
				queueName: 'player-score-writes',
			},
		])
	}
})
