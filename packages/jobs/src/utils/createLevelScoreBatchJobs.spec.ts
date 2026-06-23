import { expect, test } from 'bun:test'
import { createLevelScoreBatchJobs, LEVEL_SCORE_BATCH_SIZE } from './createLevelScoreBatchJobs'

test('groups level score updates into bounded jobs with one percentile snapshot', () => {
	const jobs = createLevelScoreBatchJobs(
		Array.from({ length: LEVEL_SCORE_BATCH_SIZE * 2 + 1 }, (_, index) => index + 1),
		42.5,
	)

	expect(jobs).toHaveLength(3)
	expect(jobs.map((job) => job.payload.ids.length)).toEqual([50, 50, 1])
	expect(jobs.every((job) => job.identifier === 'updateLevelScoresBatch')).toBe(true)
	expect(jobs.every((job) => job.payload.personalBestCountPercentile === 42.5)).toBe(true)
})
