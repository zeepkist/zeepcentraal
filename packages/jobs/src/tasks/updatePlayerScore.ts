import { calculatePlayerPointsFromContributions } from '@zeepkist/core/score'
import {
	getUserPointContributionsForUsers,
	updateUserPointContributionPlayerValuesBulk,
	upsertUserPoints,
} from '@zeepkist/database'
import { getPostgresErrorMetadata } from '../utils/postgresError'
import type { TaskHandler } from './types'

type Payload = {
	idUser?: number
}

export const updatePlayerScore: TaskHandler<Payload> = async (payload, helpers) => {
	if (!payload.idUser) {
		helpers.logger.warn('updatePlayerScore skipped: missing idUser payload.')
		return
	}
	const taskStartedAt = Date.now()
	helpers.logger.info(`updatePlayerScore started for idUser=${payload.idUser}.`)

	try {
		const contributionsByUser = await getUserPointContributionsForUsers([payload.idUser])
		const sourceContributions = contributionsByUser.get(payload.idUser) ?? []
		const { points, totalPoints, contributions } =
			calculatePlayerPointsFromContributions(sourceContributions)
		await Promise.all([
			upsertUserPoints({
				idUser: payload.idUser,
				points,
				totalPoints,
			}),
			updateUserPointContributionPlayerValuesBulk([
				{ idUser: payload.idUser, contributions },
			]),
		])
		helpers.logger.info(`updatePlayerScore completed for idUser=${payload.idUser}.`, {
			totalMs: Date.now() - taskStartedAt,
		})
	} catch (error) {
		helpers.logger.error(`Error updating player score for idUser=${payload.idUser}`, {
			idUsers: [payload.idUser],
			totalMs: Date.now() - taskStartedAt,
			postgres: getPostgresErrorMetadata(error),
		})
		throw error
	}
}
