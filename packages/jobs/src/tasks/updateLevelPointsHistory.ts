import { getChangedLevelPointIds } from '@zeepkist/database'
import { batchProcess } from '../utils'
import type { TaskHandler } from './types'

const BATCH_SIZE = 200
const ENQUEUE_BATCH_SIZE = 100

type Payload = Record<string, never>

export const updateLevelPointsHistory: TaskHandler<Payload> = async (_payload, helpers) => {
	const ids = await getChangedLevelPointIds()
	if (ids.length === 0) {
		helpers.logger.info('No level points found for history sync.')
		return
	}

	let totalBatches = 0
	let enqueueBatch: Array<{ identifier: string; payload: { ids: number[] }; jobKey: string }> = []

	for (const idsBatch of batchProcess(ids, BATCH_SIZE)) {
		totalBatches++
		enqueueBatch.push({
			identifier: 'updateLevelPointsHistoryBatch',
			payload: { ids: idsBatch },
			jobKey: `level-points-history:${idsBatch[0]}-${idsBatch.at(-1)}`,
		})

		if (enqueueBatch.length >= ENQUEUE_BATCH_SIZE) {
			await helpers.addJobs(enqueueBatch)
			enqueueBatch = []
		}
	}

	if (enqueueBatch.length > 0) {
		await helpers.addJobs(enqueueBatch)
	}

	helpers.logger.info(`Queued ${totalBatches} updateLevelPointsHistoryBatch jobs.`)
}
