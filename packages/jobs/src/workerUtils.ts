import { wrapWorkerUtils } from './jobTelemetry'
import { PgmqQueue, queueClient } from './pgmq'
import type { JobLane } from './queueTypes'

export async function createQueueWorkerUtils(lane: JobLane = 'bulk') {
	const queue = new PgmqQueue(queueClient(), lane)
	try {
		await queue.initialize()
	} catch (error) {
		await queue.release()
		throw error
	}
	return wrapWorkerUtils(queue)
}
