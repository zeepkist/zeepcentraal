import {
	getChangedLevelPointsPaginated,
	getLevelPointsByIds,
	insertLevelPointsHistories,
} from '@zeepkist/database'
import type { TaskHandler } from './types'

type Payload = {
	ids?: number[]
	offset?: number
	limit?: number
}

export const updateLevelPointsHistoryBatch: TaskHandler<Payload> = async (payload, helpers) => {
	const offset = payload.offset ?? 0
	const limit = payload.limit ?? 0

	if (!payload.ids && limit <= 0) {
		helpers.logger.warn('updateLevelPointsHistoryBatch skipped: missing/invalid limit payload.')
		return
	}

	try {
		const points = payload.ids
			? await getLevelPointsByIds(payload.ids)
			: await getChangedLevelPointsPaginated(offset, limit)
		if (points.length === 0) {
			return
		}

		await insertLevelPointsHistories(points)
	} catch (error) {
		helpers.logger.error(`Failed to process level points batch at offset ${offset}.`, {
			error,
		})
		throw error
	}
}
