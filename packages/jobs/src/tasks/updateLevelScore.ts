import { playerScoreJobOptions } from '../utils/playerScoreJobOptions'
import { updateLevelScoreBatch } from './levelScoreBatch'
import type { TaskHandler } from './types'

type Payload = {
	idLevel?: number
	idUser?: number
	reportOnly?: boolean
}

export const updateLevelScore: TaskHandler<Payload> = async (payload, helpers) => {
	const { idLevel } = payload
	if (!idLevel) {
		helpers.logger.warn('updateLevelScore skipped: missing idLevel payload.')
		return
	}

	const result = await updateLevelScoreBatch({
		idLevels: [idLevel],
		reportOnly: payload.reportOnly,
		logger: helpers.logger,
	})

	if (!payload.reportOnly && result.affectedUserIds.length > 0) {
		await helpers.addJobs(
			result.affectedUserIds.map((idUser) => {
				const options = playerScoreJobOptions('updatePlayerScore', { idUser })
				return {
					identifier: 'updatePlayerScore',
					payload: { idUser },
					jobKey: options.jobKey,
					queueName: options.queueName,
				}
			}),
		)
	}

	helpers.logger.info(`updateLevelScore completed for idLevel=${idLevel}.`, {
		affectedUsers: result.affectedUserIds.length,
	})
}
