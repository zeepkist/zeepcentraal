import type { UpdateLevelPointsPayload } from '@zeepkist/database'
import {
	getLevelWorkshopAvailabilities,
	getPersonalBestsWithRecordByLevelIds,
	getVoteValuesByLevelIds,
	setLevelPointsToZeroBulk,
	upsertLevelPointsBulk,
} from '@zeepkist/database'
import { calculateLevelPoints, calculateVoteRating, isLevelScoreEligible } from '../utils'

export async function updateLevelScoreBatch(
	idLevels: number[],
	personalBestCountPercentile: number,
): Promise<{ updated: number; zeroed: number }> {
	if (idLevels.length === 0) {
		return { updated: 0, zeroed: 0 }
	}

	const [availabilityByLevel, personalBests, voteValuesByLevel] = await Promise.all([
		getLevelWorkshopAvailabilities(idLevels),
		getPersonalBestsWithRecordByLevelIds({ idLevels, limit: 50 }),
		getVoteValuesByLevelIds(idLevels),
	])

	const personalBestsByLevel = new Map<number, { time: number; totalCount: number }[]>()
	for (const personalBest of personalBests) {
		const entries = personalBestsByLevel.get(personalBest.idLevel) ?? []
		entries.push({
			time: personalBest.time,
			totalCount: Number(personalBest.totalCount),
		})
		personalBestsByLevel.set(personalBest.idLevel, entries)
	}

	const zeroIds: number[] = []
	const updates: UpdateLevelPointsPayload[] = []

	for (const idLevel of idLevels) {
		const availability = availabilityByLevel.get(idLevel) ?? {
			adventure: false,
			itemCount: 0,
			accessibleItemCount: 0,
		}
		if (!isLevelScoreEligible(availability)) {
			zeroIds.push(idLevel)
			continue
		}

		const levelPersonalBests = personalBestsByLevel.get(idLevel) ?? []
		const rating = calculateVoteRating(voteValuesByLevel.get(idLevel) ?? [])
		const { points, modifiers } = calculateLevelPoints({
			topTimes: levelPersonalBests.map((personalBest) => personalBest.time),
			personalBests: levelPersonalBests.at(0)?.totalCount ?? 0,
			rating,
			personalBestCountPercentile,
		})

		updates.push({
			idLevel,
			points,
			rating,
			lengthModifier: modifiers.lengthModifier,
			competitivenessModifier: modifiers.competitivenessModifier,
			ratingModifier: modifiers.ratingModifier,
			popularityModifier: modifiers.popularityModifier,
			cutPenalty: modifiers.cutPenalty,
		})
	}

	await Promise.all([upsertLevelPointsBulk(updates), setLevelPointsToZeroBulk(zeroIds)])
	return { updated: updates.length, zeroed: zeroIds.length }
}
