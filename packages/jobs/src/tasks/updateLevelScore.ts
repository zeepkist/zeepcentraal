import {
	getLevelWorkshopAvailability,
	getPersonalBestCount90thPercentile,
	getPersonalBestsWithRecord,
	getVoteValues,
	setLevelPointsToZero,
	upsertLevelPoints,
} from '@zeepkist/database'
import { calculateLevelPoints, calculateVoteRating, isLevelScoreEligible } from '../utils'
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

	const availability = await getLevelWorkshopAvailability(idLevel)
	if (!isLevelScoreEligible(availability)) {
		await setLevelPointsToZero(idLevel)
		if (idUser) {
			await helpers.addJob(
				'updatePlayerScore',
				{ idUser },
				{ jobKey: `update-player-score:${idUser}` },
			)
		}
		helpers.logger.info(`updateLevelScore set inaccessible idLevel=${idLevel} to zero.`)
		return
	}

	const [personalBests, voteValues, personalBestCountPercentile] = await Promise.all([
		getPersonalBestsWithRecord({ idLevel, limit: 50 }),
		getVoteValues({ idLevel }),
		getPersonalBestCount90thPercentile(),
	])

	const topTimes = personalBests.map((pb) => pb.time)
	const personalBestCount = Number(personalBests.at(0)?.totalCount ?? 0)
	const rating = calculateVoteRating(voteValues)

	const { points, modifiers } = calculateLevelPoints({
		topTimes,
		personalBests: personalBestCount,
		rating,
		personalBestCountPercentile,
	})

	await upsertLevelPoints({
		idLevel,
		points,
		rating,
		lengthModifier: modifiers.lengthModifier,
		competitivenessModifier: modifiers.competitivenessModifier,
		ratingModifier: modifiers.ratingModifier,
		popularityModifier: modifiers.popularityModifier,
		cutPenalty: modifiers.cutPenalty,
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
