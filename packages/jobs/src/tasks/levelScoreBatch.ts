import {
	calculateLevelPoints,
	calculateVoteRating,
	getVoteRatingMaturityCutoff,
	isLevelScoreEligible,
	type LevelScorePersonalBest,
	type LevelScoreTelemetry,
} from '@zeepkist/core/score'
import type { UpdateLevelPointsPayload } from '@zeepkist/database'
import {
	getLevelPointsByIds,
	getLevelWorkshopAvailabilities,
	getPersonalBestsWithRecordByLevelIds,
	getVoteValuesByLevelIds,
	setLevelPointsToZeroBulk,
	upsertLevelPointsBulk,
} from '@zeepkist/database'
import type { Helpers } from 'graphile-worker'
import { refreshCachedLevelLeaderboards } from '../utils/playerScoreLeaderboardCache'

type PersonalBestRow = Awaited<ReturnType<typeof getPersonalBestsWithRecordByLevelIds>>[number]

function mapTelemetry(row: PersonalBestRow): LevelScoreTelemetry | null {
	const hasStatistic =
		row.statisticTime !== null ||
		row.distance !== null ||
		row.hasInputData !== null ||
		row.hasStateData !== null
	if (!hasStatistic) return null

	return {
		time: row.statisticTime,
		distance: row.distance,
		averageSpeed: row.averageSpeed,
		maxSpeed: row.maxSpeed,
		timeInAir: row.timeInAir,
		timeOnGround: row.timeOnGround,
		timeSlipping: row.timeSlipping,
		timeRagdoll: row.timeRagdoll,
		averageAngularVelocity: row.averageAngularVelocity,
		averageGforce: row.averageGforce,
		timeOnTarmac: row.timeOnTarmac,
		timeOnGrass: row.timeOnGrass,
		timeOnSand: row.timeOnSand,
		timeOnSnow: row.timeOnSnow,
		timeOnIce: row.timeOnIce,
		timeOnSoap: row.timeOnSoap,
		timeOnMetal: row.timeOnMetal,
		turnLeftCount: row.turnLeftCount,
		turnLeftTime: row.turnLeftTime,
		turnRightCount: row.turnRightCount,
		turnRightTime: row.turnRightTime,
		brakeCount: row.brakeCount,
		brakeTime: row.brakeTime,
		armsUpCount: row.armsUpCount,
		armsUpTime: row.armsUpTime,
		driverInputTransitionCount: row.driverInputTransitionCount,
		timeAnyDriverInput: row.timeAnyDriverInput,
		hasInputData: row.hasInputData,
		hasAirData: row.hasAirData,
		hasWheelData: row.hasWheelData,
		hasSlipData: row.hasSlipData,
		hasStateData: row.hasStateData,
		hasSurfaceData: row.hasSurfaceData,
		hasVelocityData: row.hasVelocityData,
		hasRagdollData: row.hasRagdollData,
	}
}

function mapPersonalBest(row: PersonalBestRow): LevelScorePersonalBest {
	return {
		time: row.time,
		dateCreated: row.dateCreated,
		splits: row.splits?.map((time, index) => ({
			time,
			speed: row.speeds?.[index] ?? null,
		})),
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

	const [availabilityByLevel, personalBests, voteValuesByLevel] = await Promise.all([
		getLevelWorkshopAvailabilities(idLevels),
		getPersonalBestsWithRecordByLevelIds({ idLevels, limit: 50 }),
		getVoteValuesByLevelIds(idLevels, getVoteRatingMaturityCutoff()),
	])

	const personalBestsByLevel = new Map<number, PersonalBestRow[]>()
	for (const personalBest of personalBests) {
		const entries = personalBestsByLevel.get(personalBest.idLevel) ?? []
		entries.push(personalBest)
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
		const matureVotes = voteValuesByLevel.get(idLevel) ?? []
		const rating = calculateVoteRating(matureVotes)
		const score = calculateLevelPoints({
			personalBests: levelPersonalBests.map(mapPersonalBest),
			personalBestCount: Number(levelPersonalBests.at(0)?.totalCount ?? 0),
			eligibleLevelP90PersonalBestCount: personalBestCountPercentile,
			voteRating: rating,
			matureVoteCount: matureVotes.length,
		})
		const { metrics, factors } = score

		updates.push({
			idLevel,
			points: score.points,
			rating,
			lengthModifier: factors.lengthFactor,
			competitivenessModifier: 0.1 + 1.9 * factors.competitiveMerit,
			ratingModifier: factors.voteFactor,
			popularityModifier: factors.participationFactor,
			cutPenalty: 1,
			sampleSize: metrics.sampleSize,
			leaderboardConfidence: metrics.leaderboardConfidence,
			inputSampleSize: metrics.inputSampleSize,
			inputCoverage: metrics.inputCoverage,
			airSampleSize: metrics.airSampleSize,
			wheelSampleSize: metrics.wheelSampleSize,
			slipSampleSize: metrics.slipSampleSize,
			ragdollSampleSize: metrics.ragdollSampleSize,
			stateSampleSize: metrics.stateSampleSize,
			surfaceSampleSize: metrics.surfaceSampleSize,
			velocitySampleSize: metrics.velocitySampleSize,
			competitivenessScore: metrics.competitivenessScore,
			worldRecordDifficultyScore: metrics.worldRecordDifficultyScore,
			participationScore: metrics.participationScore,
			passivePlaySeverity: metrics.passivePlaySeverity,
			modifierAfk: metrics.afkModifier,
			passiveRunRatio: metrics.passiveRunRatio,
			passiveTop10Share: metrics.passiveTop10Share,
			bestPassiveRank: metrics.bestPassiveRank,
			bestPassiveGap: metrics.bestPassiveGap,
			driverEngagementScore: metrics.driverEngagementScore,
			worldRecordMargin: metrics.worldRecordMargin,
			top5Spread: metrics.top5Spread,
			top10Spread: metrics.top10Spread,
			top50Spread: metrics.top50Spread,
			wrChallengerCount: metrics.wrChallengerCount,
			worldRecordOptimizationScore: metrics.worldRecordOptimizationScore,
			leaderboardAnomalyScore: metrics.leaderboardAnomalyScore,
			telemetryAnomalyScore: metrics.telemetryAnomalyScore,
			worldRecordExcluded: metrics.worldRecordExcluded,
			pathConsistencyScore: metrics.pathConsistencyScore,
			speedConsistencyScore: metrics.speedConsistencyScore,
			routeConsistencyScore: metrics.routeConsistencyScore,
			surfaceDiversityScore: metrics.surfaceDiversityScore,
			matureVoteCount: metrics.matureVoteCount,
			typicalDistance: metrics.typicalDistance,
			typicalAverageSpeed: metrics.typicalAverageSpeed,
			typicalMaxSpeed: metrics.typicalMaxSpeed,
			typicalAirTimeShare: metrics.typicalAirTimeShare,
			typicalGroundTimeShare: metrics.typicalGroundTimeShare,
			typicalSlipShare: metrics.typicalSlipShare,
			typicalRagdollShare: metrics.typicalRagdollShare,
			typicalAverageAngularVelocity: metrics.typicalAverageAngularVelocity,
			typicalAverageGforce: metrics.typicalAverageGforce,
			medianSteeringShare: metrics.medianSteeringShare,
			q25SteeringShare: metrics.q25SteeringShare,
			lowSteeringRatio: metrics.lowSteeringRatio,
			zeroControlRatio: metrics.zeroControlRatio,
			medianBrakeShare: metrics.medianBrakeShare,
			medianArmsUpShare: metrics.medianArmsUpShare,
			medianControlTransitionRate: metrics.medianControlTransitionRate,
		})
	}

	if (reportOnly) {
		const currentByLevel = new Map(
			(await getLevelPointsByIds(idLevels)).map((entry) => [entry.idLevel, entry.points]),
		)
		logger.info('Calculated report-only level scores.', {
			levels: updates.map((update) => {
				const currentPoints = currentByLevel.get(update.idLevel) ?? null
				return {
					idLevel: update.idLevel,
					currentPoints,
					proposedPoints: update.points,
					delta: currentPoints === null ? null : update.points - currentPoints,
					passivePlaySeverity: update.passivePlaySeverity,
					worldRecordExcluded: update.worldRecordExcluded,
				}
			}),
			zeroedLevelIds: zeroIds,
		})
		return { updated: 0, zeroed: 0, reported: updates.length + zeroIds.length }
	}

	await Promise.all([upsertLevelPointsBulk(updates), setLevelPointsToZeroBulk(zeroIds)])
	await refreshCachedLevelLeaderboards({ idLevels, logger })
	return { updated: updates.length, zeroed: zeroIds.length, reported: 0 }
}
