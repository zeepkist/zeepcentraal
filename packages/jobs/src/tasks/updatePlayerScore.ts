import {
	clearUserPointContributions,
	getUserPersonalBestsWithLevelPointsAndPosition,
	upsertUserPointContributionsBulk,
	upsertUserPoints,
} from '@zeepkist/database'
import { calculatePlayerPoints } from '../utils'
import type { TaskHandler } from './types'

type Payload = {
	idUser?: number
}

export const updatePlayerScore: TaskHandler<Payload> = async (payload, helpers) => {
	if (!payload.idUser) {
		helpers.logger.warn('updatePlayerScore skipped: missing idUser payload.')
		return
	}

	try {
		const personalBests = await getUserPersonalBestsWithLevelPointsAndPosition({
			idUser: payload.idUser,
		})

		if (personalBests.length === 0) {
			await clearUserPointContributions([payload.idUser])
			helpers.logger.info(
				`updatePlayerScore skipped for idUser=${payload.idUser}; no personal bests found.`,
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
	} catch (error) {
		helpers.logger.error(`Error updating player score for idUser=${payload.idUser}`, { error })
		throw error
	}
}
