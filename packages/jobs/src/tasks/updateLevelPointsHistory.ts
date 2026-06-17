import { getTotalLevelPoints } from '@zeepkist/database'
import type { TaskHandler } from './types'

const BATCH_SIZE = 200

type Payload = Record<string, never>

export const updateLevelPointsHistory: TaskHandler<Payload> = async (_payload, helpers) => {
	const totalPoints = await getTotalLevelPoints()
	if (totalPoints <= 0) {
		helpers.logger.info('No level points found for history sync.')
		return
	}

	const totalBatches = Math.ceil(totalPoints / BATCH_SIZE)
	for (let index = 0; index < totalBatches; index++) {
		const offset = index * BATCH_SIZE
		await helpers.addJob('updateLevelPointsHistoryBatch', { offset, limit: BATCH_SIZE })
	}

	helpers.logger.info(`Queued ${totalBatches} updateLevelPointsHistoryBatch jobs.`)
}
