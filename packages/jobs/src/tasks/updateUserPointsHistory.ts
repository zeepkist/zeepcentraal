import { getAllUserPointIds } from '@zeepkist/database'
import { batchProcess } from '../utils'
import type { TaskHandler } from './types'

const BATCH_SIZE = 200
const ENQUEUE_BATCH_SIZE = 100

type Payload = Record<string, never>

export const updateUserPointsHistory: TaskHandler<Payload> = async (_payload, helpers) => {
	const ids = await getAllUserPointIds()
	if (ids.length === 0) {
		helpers.logger.info('No user points found for history sync.')
		return
	}

	let totalBatches = 0
	let enqueueBatch: Array<{ identifier: string; payload: { ids: number[] }; jobKey: string }> = []

	for (const idsBatch of batchProcess(ids, BATCH_SIZE)) {
		totalBatches++
		enqueueBatch.push({
			identifier: 'updateUserPointsHistoryBatch',
			payload: { ids: idsBatch },
			jobKey: `user-points-history:${idsBatch[0]}-${idsBatch.at(-1)}`,
		})

		if (enqueueBatch.length >= ENQUEUE_BATCH_SIZE) {
			await helpers.addJobs(enqueueBatch)
			enqueueBatch = []
		}
	}

	if (enqueueBatch.length > 0) {
		await helpers.addJobs(enqueueBatch)
	}

	helpers.logger.info(`Queued ${totalBatches} updateUserPointsHistoryBatch jobs.`)
}
