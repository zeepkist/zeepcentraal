import { expect, test } from 'bun:test'
import { JOBS_WORKER_CONCURRENCY, jobsWorkerPreset } from './workerOptions'

test('prefetches concurrency plus one job with batched completion and failure writes', () => {
	expect(jobsWorkerPreset.worker).toEqual({
		localQueue: { size: JOBS_WORKER_CONCURRENCY + 1 },
		completeJobBatchDelay: 50,
		failJobBatchDelay: 250,
	})
})
