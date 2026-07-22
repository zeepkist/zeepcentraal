import {
	isTrackTournamentType,
	rotateTrackTournament as rotateDatabaseTrackTournament,
} from '@zeepkist/database'
import type { TaskHandler } from './types'

type RotateTrackTournamentPayload = { type?: number }

export const rotateTrackTournament: TaskHandler<RotateTrackTournamentPayload> = async (
	payload,
	helpers,
) => {
	const type = payload.type ?? -1
	if (!isTrackTournamentType(type)) {
		helpers.logger.warn('rotateTrackTournament skipped: invalid tournament type.')
		return
	}
	const result = await rotateDatabaseTrackTournament(type)
	if (result.reason === 'empty-pool') {
		helpers.logger.warn('rotateTrackTournament found no unused top-quartile level.', {
			type,
		})
		return
	}
	helpers.logger.info('rotateTrackTournament completed.', {
		created: result.created,
		type,
	})
}
