import { getTotalUserPoints } from '@zeepkist/database'
import type { TaskHandler } from './types'

const BATCH_SIZE = 200
const ENQUEUE_BATCH_SIZE = 100

type Payload = Record<string, never>

export const updateUserPointsHistory: TaskHandler<Payload> = async (_payload, helpers) => {
	const totalPoints = await getTotalUserPoints()
	if (totalPoints <= 0) {
		helpers.logger.info('No user points found for history sync.')
		return
	}

	const totalBatches = Math.ceil(totalPoints / BATCH_SIZE)
	let enqueueBatch: Array<{ identifier: string; payload: { offset: number; limit: number } }> = []

	for (let index = 0; index < totalBatches; index++) {
		const offset = index * BATCH_SIZE
		enqueueBatch.push({
			identifier: 'updateUserPointsHistoryBatch',
			payload: { offset, limit: BATCH_SIZE },
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
