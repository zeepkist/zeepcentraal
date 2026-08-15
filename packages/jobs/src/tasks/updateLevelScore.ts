import { playerScoreJobOptions } from '../utils/playerScoreJobOptions'
import { updateLevelScoreBatch } from './levelScoreBatch'
import type { TaskHandler } from './types'

type Payload = {
	idLevel?: number
	idUser?: number
	reportOnly?: boolean
}

export const updateLevelScore: TaskHandler<Payload> = async (payload, helpers) => {
	const { idLevel, idUser } = payload
	if (!idLevel) {
		helpers.logger.warn('updateLevelScore skipped: missing idLevel payload.')
		return
	}

	await updateLevelScoreBatch({
		idLevels: [idLevel],
		reportOnly: payload.reportOnly,
		logger: helpers.logger,
	})

	if (idUser && !payload.reportOnly) {
		await helpers.addJob(
			'updatePlayerScore',
			{ idUser },
			playerScoreJobOptions('updatePlayerScore', { idUser }),
		)
	}

	helpers.logger.info(`updateLevelScore completed for idLevel=${idLevel}.`)
}
