import { expect, test } from 'bun:test'
import { jobsWorkerPreset } from './workerOptions'

test('does not prefetch jobs outside Graphile named-queue execution', () => {
	expect(jobsWorkerPreset.worker).toEqual({
		completeJobBatchDelay: 0,
		failJobBatchDelay: 0,
	})
	expect(jobsWorkerPreset.worker).not.toHaveProperty('localQueue')
})
