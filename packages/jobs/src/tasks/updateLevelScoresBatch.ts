import { updateLevelScoreBatch } from './levelScoreBatch'
import type { TaskHandler } from './types'

type Payload = {
	ids?: number[]
	reportOnly?: boolean
}

export const updateLevelScoresBatch: TaskHandler<Payload> = async (payload, helpers) => {
	const { ids } = payload
	if (!ids?.length) {
		helpers.logger.warn('updateLevelScoresBatch skipped: missing ids payload.')
		return
	}

	const result = await updateLevelScoreBatch({
		idLevels: ids,
		reportOnly: payload.reportOnly,
		logger: helpers.logger,
	})

	helpers.logger.info(
		`updateLevelScoresBatch completed ${ids.length} levels (${result.updated} updated, ${result.zeroed} zeroed, ${result.reported} reported).`,
	)
}
