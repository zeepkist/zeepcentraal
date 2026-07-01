import { updateLevelScoreBatch } from './levelScoreBatch'
import type { TaskHandler } from './types'

type Payload = {
	ids?: number[]
	personalBestCountPercentile?: number
}

export const updateLevelScoresBatch: TaskHandler<Payload> = async (payload, helpers) => {
	const { ids, personalBestCountPercentile } = payload
	if (!ids?.length || personalBestCountPercentile === undefined) {
		helpers.logger.warn('updateLevelScoresBatch skipped: missing ids or percentile payload.')
		return
	}

	const result = await updateLevelScoreBatch({
		idLevels: ids,
		personalBestCountPercentile,
		logger: helpers.logger,
	})

	helpers.logger.info(
		`updateLevelScoresBatch completed ${ids.length} levels (${result.updated} updated, ${result.zeroed} zeroed).`,
	)
}
