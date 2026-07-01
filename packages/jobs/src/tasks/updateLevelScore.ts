import { getPersonalBestCount90thPercentile } from '@zeepkist/database'
import { updateLevelScoreBatch } from './levelScoreBatch'
import type { TaskHandler } from './types'

type Payload = {
	idLevel?: number
	idUser?: number
}

export const updateLevelScore: TaskHandler<Payload> = async (payload, helpers) => {
	const { idLevel, idUser } = payload
	if (!idLevel) {
		helpers.logger.warn('updateLevelScore skipped: missing idLevel payload.')
		return
	}

	const personalBestCountPercentile = await getPersonalBestCount90thPercentile()
	await updateLevelScoreBatch({
		idLevels: [idLevel],
		personalBestCountPercentile,
		logger: helpers.logger,
	})

	if (idUser) {
		await helpers.addJob(
			'updatePlayerScore',
			{ idUser },
			{ jobKey: `update-player-score:${idUser}` },
		)
	}

	helpers.logger.info(`updateLevelScore completed for idLevel=${idLevel}.`)
}
