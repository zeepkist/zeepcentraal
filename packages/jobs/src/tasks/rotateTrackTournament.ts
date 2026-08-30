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
		helpers.logger.warn(
			'rotateTrackTournament found no unused level in tournament quality pool.',
			{
				type,
			},
		)
		return
	}
	if (result.idTournament) {
		await helpers.addJob(
			'prepareTrackTournamentLobbyAsset',
			{ idTournament: result.idTournament },
			{ jobKey: `prepare-track-tournament-lobby-asset:${result.idTournament}` },
		)
	}
	helpers.logger.info('rotateTrackTournament completed.', {
		created: result.created,
		type,
	})
}
