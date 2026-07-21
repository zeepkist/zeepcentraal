import { calculatePlayerPoints } from '@zeepkist/core/score'
import {
	clearUserPointContributions,
	getUserPersonalBestsWithLevelPointsAndPosition,
	upsertUserPointContributionsBulk,
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
		const personalBests = await getUserPersonalBestsWithLevelPointsAndPosition({
			idUser: payload.idUser,
		})

		if (personalBests.length === 0) {
			await clearUserPointContributions([payload.idUser])
			helpers.logger.info(
				`updatePlayerScore skipped for idUser=${payload.idUser}; no personal bests found.`,
				{ totalMs: Date.now() - taskStartedAt },
			)
			return
		}

		const { points, totalPoints, contributions } = calculatePlayerPoints(personalBests)
		await Promise.all([
			upsertUserPoints({
				idUser: payload.idUser,
				points,
				totalPoints,
			}),
			upsertUserPointContributionsBulk([{ idUser: payload.idUser, contributions }]),
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
