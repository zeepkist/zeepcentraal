import { expect, test } from 'bun:test'
import { DEFAULT_JOB_PRIORITY, PRIORITY_JOB_PRIORITY } from '../priorities'
import {
	createLevelScoreBatchJobs,
	LEVEL_SCORE_BATCH_SIZE,
	LEVEL_SCORE_QUEUE_NAMES,
} from './createLevelScoreBatchJobs'

test('groups level score updates into bounded jobs', () => {
	const jobs = createLevelScoreBatchJobs(
		Array.from({ length: LEVEL_SCORE_BATCH_SIZE * 2 + 1 }, (_, index) => index + 1),
	)

	expect(jobs).toHaveLength(3)
	expect(jobs.map((job) => job.payload.ids.length)).toEqual([100, 100, 1])
	expect(jobs.every((job) => job.identifier === 'updateLevelScoresBatch')).toBe(true)
	expect(jobs.every((job) => job.payload.reportOnly === false)).toBe(true)
	expect(jobs.map((job) => job.queueName)).toEqual([
		LEVEL_SCORE_QUEUE_NAMES[0],
		LEVEL_SCORE_QUEUE_NAMES[1],
		LEVEL_SCORE_QUEUE_NAMES[0],
	])
	expect(jobs.every((job) => job.priority === DEFAULT_JOB_PRIORITY)).toBe(true)
})

test('prioritizes incremental batches without changing stable keys', () => {
	const [job] = createLevelScoreBatchJobs([1, 2], false, true)
	expect(job?.priority).toBe(PRIORITY_JOB_PRIORITY)
	expect(job?.jobKey).toBe('update-level-scores-batch:1-2')
})

test('propagates report-only mode to every batch', () => {
	const jobs = createLevelScoreBatchJobs([1, 2], true)
	expect(jobs.every((job) => job.payload.reportOnly)).toBe(true)
	expect(jobs[0]?.jobKey).toBe('update-level-scores-batch-report:1-2')
	expect(createLevelScoreBatchJobs([1, 2])[0]?.jobKey).toBe('update-level-scores-batch:1-2')
})
