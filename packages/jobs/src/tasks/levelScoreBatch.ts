import {
	calculateLevelPointsV2 as calculateLevelPoints,
	calculateVoteRating,
	getVoteRatingMaturityCutoff,
	isLevelScoreEligible,
	type LevelScorePersonalBest,
	type LevelScoreTelemetry,
} from '@zeepkist/core/score'
import type { UpdateLevelPointsPayload } from '@zeepkist/database'
import {
	getLevelPointValuesByIds,
	getLevelSkillMetricsByLevelIds,
	getLevelWorkshopAvailabilities,
	getV2ScorePersonalBestsByLevelIds,
	getVoteValuesByLevelIds,
	setLevelPointsToZeroBulk,
	syncUserPointContributionLevels,
	upsertLevelPointsBulk,
} from '@zeepkist/database'
import type { Helpers } from 'graphile-worker'

type PersonalBestRow = Awaited<ReturnType<typeof getV2ScorePersonalBestsByLevelIds>>[number]

function mapTelemetry(row: PersonalBestRow): LevelScoreTelemetry | null {
	const hasStatistic = row.statisticTime !== null || row.hasInputData !== null
	if (!hasStatistic) return null

	return {
		time: row.statisticTime,
		turnLeftCount: row.turnLeftCount,
		turnLeftTime: row.turnLeftTime,
		turnRightCount: row.turnRightCount,
		turnRightTime: row.turnRightTime,
		brakeCount: row.brakeCount,
		brakeTime: row.brakeTime,
		armsUpCount: row.armsUpCount,
		armsUpTime: row.armsUpTime,
		driverInputTransitionCount: row.driverInputTransitionCount,
		hasInputData: row.hasInputData,
	}
}

function mapPersonalBest(row: PersonalBestRow): LevelScorePersonalBest {
	return {
		time: row.time,
		dateCreated: row.dateCreated,
		splits: row.splits?.map((time) => ({ time })),
		telemetry: mapTelemetry(row),
	}
}

export async function updateLevelScoreBatch({
	idLevels,
	personalBestCountPercentile,
	reportOnly = false,
	logger,
}: {
	idLevels: number[]
	personalBestCountPercentile: number
	reportOnly?: boolean
	logger: Helpers['logger']
}): Promise<{ updated: number; zeroed: number; reported: number }> {
	if (idLevels.length === 0) {
		return { updated: 0, zeroed: 0, reported: 0 }
	}
	const startedAt = Date.now()
	const timings: Record<string, number> = {}
	const timed = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
		const phaseStartedAt = Date.now()
		try {
			return await operation()
		} finally {
			timings[`${name}Ms`] = Date.now() - phaseStartedAt
		}
	}

	const availabilityByLevel = await timed('availability', () =>
		getLevelWorkshopAvailabilities(idLevels),
	)
	const eligibleIds = idLevels.filter((idLevel) =>
		isLevelScoreEligible(
			availabilityByLevel.get(idLevel) ?? {
				adventure: false,
				itemCount: 0,
				accessibleItemCount: 0,
			},
		),
	)
	const zeroIds = idLevels.filter((idLevel) => !eligibleIds.includes(idLevel))
	const [personalBests, skillMetricsByLevel, voteValuesByLevel] =
		eligibleIds.length > 0
			? await Promise.all([
					timed('personalBests', () =>
						getV2ScorePersonalBestsByLevelIds({ idLevels: eligibleIds, limit: 50 }),
					),
					timed('skillMetrics', () => getLevelSkillMetricsByLevelIds(eligibleIds)),
					timed('votes', () =>
						getVoteValuesByLevelIds(eligibleIds, getVoteRatingMaturityCutoff()),
					),
				])
			: [[], new Map(), new Map()]

	const personalBestsByLevel = new Map<number, PersonalBestRow[]>()
	for (const personalBest of personalBests) {
		const entries = personalBestsByLevel.get(personalBest.idLevel) ?? []
		entries.push(personalBest)
		personalBestsByLevel.set(personalBest.idLevel, entries)
	}

	const updates: UpdateLevelPointsPayload[] = []
	const calculationStartedAt = Date.now()

	for (const idLevel of eligibleIds) {
		const levelPersonalBests = personalBestsByLevel.get(idLevel) ?? []
		const matureVotes = voteValuesByLevel.get(idLevel) ?? []
		const rating = calculateVoteRating(matureVotes)
		const score = calculateLevelPoints({
			personalBests: levelPersonalBests.map(mapPersonalBest),
			personalBestCount: Number(levelPersonalBests.at(0)?.totalCount ?? 0),
			eligibleLevelP90PersonalBestCount: personalBestCountPercentile,
			skill: skillMetricsByLevel.get(idLevel) ?? null,
			voteRating: rating,
			matureVoteCount: matureVotes.length,
		})
		const { metrics, factors } = score

		updates.push({
			idLevel,
			points: score.points,
			rating,
			lengthModifier: factors.lengthFactor,
			competitivenessModifier: score.modifiers.competitivenessModifier,
			evidenceModifier: factors.evidenceFactor,
			qualityModifier: factors.qualityFactor,
			ratingModifier: factors.voteFactor,
			competitiveMerit: metrics.competitiveMerit,
			complexityConfidence: metrics.complexityConfidence,
			complexityScore: metrics.complexityScore,
			fieldStrength: metrics.fieldStrength,
			worldRecordExcluded: metrics.worldRecordExcluded,
			qualityScore: metrics.qualityScore,
			skillAlignment: metrics.skillAlignment,
			skillConfidence: metrics.skillConfidence,
			skillSampleSize: metrics.skillSampleSize,
			skillScore: metrics.skillScore,
			skillSeparation: metrics.skillSeparation,
		})
	}
	timings.calculationMs = Date.now() - calculationStartedAt

	const currentLevelPoints = await timed('currentPoints', () =>
		getLevelPointValuesByIds(idLevels),
	)
	const currentByLevel = new Map(currentLevelPoints.map((entry) => [entry.idLevel, entry.points]))

	if (reportOnly) {
		logger.info('Calculated report-only level scores.', {
			levels: updates.map((update) => {
				const currentPoints = currentByLevel.get(update.idLevel) ?? null
				return {
					idLevel: update.idLevel,
					currentPoints,
					proposedPoints: update.points,
					delta: currentPoints === null ? null : update.points - currentPoints,
					complexityScore: update.complexityScore,
					evidenceFactor: update.evidenceModifier,
					lengthFactor: update.lengthModifier,
					qualityScore: update.qualityScore,
					skillConfidence: update.skillConfidence,
					skillScore: update.skillScore,
					voteFactor: update.ratingModifier,
					worldRecordExcluded: update.worldRecordExcluded,
				}
			}),
			zeroedLevelIds: zeroIds,
		})
		logger.info('Level score batch timings.', {
			...timings,
			totalMs: Date.now() - startedAt,
			requested: idLevels.length,
			eligible: eligibleIds.length,
			zeroed: zeroIds.length,
			persisted: 0,
			pointChanged: 0,
			projectionLevels: 0,
			projectionUsers: 0,
			reportOnly: true,
		})
		return { updated: 0, zeroed: 0, reported: updates.length + zeroIds.length }
	}

	const proposedPoints = new Map(updates.map((update) => [update.idLevel, update.points]))
	for (const idLevel of zeroIds) proposedPoints.set(idLevel, 0)
	const pointChangedIds = idLevels.filter(
		(idLevel) =>
			!currentByLevel.has(idLevel) ||
			currentByLevel.get(idLevel) !== proposedPoints.get(idLevel),
	)
	const [updatedIds, zeroedIds] = await timed('persistence', () =>
		Promise.all([upsertLevelPointsBulk(updates), setLevelPointsToZeroBulk(zeroIds)]),
	)
	const projection = await timed('contributionProjection', () =>
		syncUserPointContributionLevels(idLevels),
	)
	logger.info('Level score batch timings.', {
		...timings,
		totalMs: Date.now() - startedAt,
		requested: idLevels.length,
		eligible: eligibleIds.length,
		zeroed: zeroIds.length,
		persisted: updatedIds.length + zeroedIds.length,
		pointChanged: pointChangedIds.length,
		projectionLevels: projection.levels,
		projectionUsers: projection.users,
		reportOnly: false,
	})
	return { updated: updatedIds.length, zeroed: zeroedIds.length, reported: 0 }
}
