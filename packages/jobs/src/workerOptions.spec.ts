import { expect, test } from 'bun:test'
import { JOBS_FAST_CONCURRENCY, JOBS_WORKER_CONCURRENCY } from './workerOptions'

test('reserves independent fast and bulk capacity', () => {
	expect(JOBS_FAST_CONCURRENCY).toBe(4)
	expect(JOBS_WORKER_CONCURRENCY).toBe(14)
})
