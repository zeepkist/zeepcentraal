import {
	LEVEL_SCORE_PERSONAL_BEST_LIMIT,
	type LegacyLevelScoreInput,
	type LevelScoreFactors,
	type LevelScoreInput,
	type LevelScorePersonalBest,
	type LevelScoreResult,
	type LevelScoreTelemetry,
	type LevelScoreTelemetrySampleCounts,
	MAX_LEVEL_POINTS,
} from './calculateLevelPoints'

export const MISSING_V6_METRIC_SCORE = 0.5

export const LEVEL_SCORE_V2_LENGTH = {
	anchors: [
		{ seconds: 3, factor: 0.01 },
		{ seconds: 6, factor: 0.08 },
		{ seconds: 10, factor: 1 },
		{ seconds: 90, factor: 1 },
		{ seconds: 180, factor: 0.95 },
		{ seconds: 300, factor: 0.9 },
		{ seconds: 600, factor: 0.8 },
	] as const,
} as const

export const LEVEL_SCORE_V2_EVIDENCE = {
	fullSampleSize: 10,
	minimumFactor: 0.1,
} as const

export const LEVEL_SCORE_V2_POPULARITY = {
	minimumFactor: 0.95,
	maximumFactor: 1,
} as const

export const LEVEL_SCORE_V2_LEADERBOARD = {
	frontier: [
		{ rank: 2, weight: 0.4, halfLife: 0.005 },
		{ rank: 3, weight: 0.35, halfLife: 0.01 },
		{ rank: 5, weight: 0.25, halfLife: 0.02 },
	] as const,
	depth: [
		{ rank: 5, weight: 0.45, halfLife: 0.03 },
		{ rank: 10, weight: 0.55, halfLife: 0.08 },
	] as const,
	information: {
		clusterTolerance: 0.000_05,
		fullRatio: 0.8,
		minimumRatio: 0.2,
	},
	mastery: {
		minimumFieldGap: 0.015,
		maximumFieldGap: 0.12,
		minimumSegmentGap: 0.01,
		maximumSegmentGap: 0.1,
	},
	factor: { minimum: 0.55, maximum: 1 },
	weights: { frontier: 0.45, depthOrMastery: 0.3, information: 0.25 },
} as const

export const LEVEL_SCORE_V2_WORLD_RECORD = {
	minimumComparableChallengers: 5,
	optimizationHalfLife: 0.03,
	referencePercentile: 0.1,
	factor: { minimum: 0.75, maximum: 1 },
	weights: { optimization: 0.4, dominance: 0.3, speedConversion: 0.3 },
} as const

export const LEVEL_SCORE_V2_EXECUTION = {
	minimumComparableRuns: 3,
	routeDeviationTolerance: 0.04,
	segmentMadHalfLife: 0.02,
	factor: { minimum: 0.85, maximum: 1 },
	weights: { route: 0.6, segmentCompetition: 0.4 },
} as const

export const LEVEL_SCORE_V2_TELEMETRY = {
	minimumComparableRuns: 3,
	steeringShare: { minimum: 0.005, maximum: 0.15 },
	steeringTransitionRate: { minimum: 0.02, maximum: 0.35 },
	lowSteeringShare: 0.005,
	lowSteeringTransitions: 1,
	distanceMadTolerance: 0.15,
	averageSpeedMadTolerance: 0.08,
	factor: { minimum: 0.8, maximum: 1 },
	weights: {
		steeringEngagement: 0.45,
		antiPassive: 0.25,
		distanceConsistency: 0.15,
		averageSpeedConsistency: 0.15,
	},
} as const

export const LEVEL_SCORE_V2_VOTE = {
	minimumFactor: 0.97,
	maximumFactor: 1.03,
} as const

export const LEVEL_SCORE_V2_POINTS = {
	minimum: 2,
	maximum: MAX_LEVEL_POINTS,
} as const

const SCORE_SAMPLE_LIMIT = 10
const APPROXIMATE_EQUALITY_TOLERANCE = 0.000_001

interface NormalizedInput {
	eligibleLevelP90PersonalBestCount: number | null
	matureVoteCount: number | null
	personalBestCount: number
	personalBests: LevelScorePersonalBest[]
	voteRating: number | null
}

interface SteeringRun {
	engagement: number
	lowSteering: boolean
	rank: number
	steeringShare: number
	steeringTransitionCount: number
	steeringTransitionRate: number
	time: number
}

interface SplitProfile {
	personalBest: LevelScorePersonalBest
	segments: number[]
	speeds: Array<number | null>
}

interface WorldRecordAnalysis {
	optimizationRatio: number | null
	score: number
	speedConversion: number | null
}

interface ExecutionAnalysis {
	routeConsistency: number | null
	score: number
}

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

const clamp = (value: number, minimum = 0, maximum = 1): number =>
	Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum

const smoothstep = (value: number): number => {
	const bounded = clamp(value)
	return bounded * bounded * (3 - 2 * bounded)
}

const smoothBetween = (value: number, start: number, end: number): number =>
	start === end ? Number(value >= end) : smoothstep((value - start) / (end - start))

const interpolate = (start: number, end: number, progress: number): number =>
	start + (end - start) * clamp(progress)

const mean = (values: readonly number[]): number | null =>
	values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null

const percentile = (values: readonly number[], quantile: number): number | null => {
	const sorted = values.filter(Number.isFinite).toSorted((left, right) => left - right)
	if (sorted.length === 0) return null
	if (sorted.length === 1) return sorted[0] ?? null

	const index = clamp(quantile) * (sorted.length - 1)
	const lowerIndex = Math.floor(index)
	const upperIndex = Math.ceil(index)
	const lower = sorted[lowerIndex] ?? 0
	const upper = sorted[upperIndex] ?? lower
	return lower + (upper - lower) * (index - lowerIndex)
}

const median = (values: readonly number[]): number | null => percentile(values, 0.5)

const approximatelyEqual = (left: number, right: number): boolean =>
	Math.abs(left - right) <=
	Math.max(Math.abs(left), Math.abs(right), 1) * APPROXIMATE_EQUALITY_TOLERANCE

/** V6 exposes slip and ragdoll capability even when both observed event counts remain zero. */
const hasExtendedTelemetry = (telemetry: LevelScoreTelemetry | null | undefined): boolean =>
	telemetry?.hasSlipData === true && telemetry.hasRagdollData === true

const canonicalPersonalBestKey = (personalBest: LevelScorePersonalBest): string =>
	JSON.stringify([
		personalBest.splits?.map((split) => [split.time, split.speed]) ?? null,
		personalBest.telemetry
			? [
					personalBest.telemetry.hasInputData,
					personalBest.telemetry.hasSlipData,
					personalBest.telemetry.hasRagdollData,
					personalBest.telemetry.hasVelocityData,
					personalBest.telemetry.time,
					personalBest.telemetry.distance,
					personalBest.telemetry.averageSpeed,
					personalBest.telemetry.turnLeftTime,
					personalBest.telemetry.turnRightTime,
					personalBest.telemetry.turnLeftCount,
					personalBest.telemetry.turnRightCount,
				]
			: null,
	])

/**
 * Percentage-gap tightness. Equal values score 1 and a gap matching `halfLife` scores 0.5.
 * Raw range: 0–1. Missing or invalid evidence returns 0.
 */
export const calculateLevelPointsV2Tightness = (
	faster: number,
	slower: number,
	halfLife: number,
): number => {
	if (faster <= 0 || slower < faster || halfLife <= 0) return 0
	return clamp(2 ** (-Math.log(slower / faster) / Math.log1p(halfLife)))
}

/** Ceiling-rounds a finite score to the next even integer. Output range: 2–9984. */
export const ceilLevelPointsV2 = (value: number): number => {
	const bounded = clamp(value, 0, LEVEL_SCORE_V2_POINTS.maximum)
	return clamp(
		Math.ceil(bounded / 2) * 2,
		LEVEL_SCORE_V2_POINTS.minimum,
		LEVEL_SCORE_V2_POINTS.maximum,
	)
}

/**
 * Track-duration factor. Median top-ten times from 10–90 seconds receive 1; sub-six-second
 * tracks approach 0.01 and long endurance tracks retain at least 0.8.
 */
export const calculateLevelPointsV2LengthFactor = (seconds: number | null): number => {
	if (!isFiniteNumber(seconds) || seconds <= 0) return 0
	const anchors = LEVEL_SCORE_V2_LENGTH.anchors
	const first = anchors[0]
	const last = anchors[anchors.length - 1]
	if (!first || !last) return 0
	if (seconds <= first.seconds) return first.factor
	if (seconds >= last.seconds) return last.factor

	for (let index = 1; index < anchors.length; index += 1) {
		const right = anchors[index]
		const left = anchors[index - 1]
		if (!left || !right || seconds > right.seconds) continue
		return interpolate(
			left.factor,
			right.factor,
			smoothstep((seconds - left.seconds) / (right.seconds - left.seconds)),
		)
	}
	return last.factor
}

const normalizeInput = (input: LevelScoreInput | LegacyLevelScoreInput): NormalizedInput => {
	if ('topTimes' in input) {
		const personalBests = input.topTimes
			.filter((time) => isFiniteNumber(time) && time > 0)
			.map((time) => ({ time }))
		const count = isFiniteNumber(input.personalBests)
			? Math.max(0, Math.trunc(input.personalBests))
			: personalBests.length
		return {
			personalBests,
			personalBestCount: Math.max(count, personalBests.length),
			eligibleLevelP90PersonalBestCount:
				isFiniteNumber(input.personalBestCountPercentile) &&
				input.personalBestCountPercentile > 0
					? input.personalBestCountPercentile
					: null,
			voteRating: isFiniteNumber(input.rating) ? clamp(input.rating) : null,
			matureVoteCount: null,
		}
	}

	const personalBests = input.personalBests.filter(
		(personalBest) => isFiniteNumber(personalBest.time) && personalBest.time > 0,
	)
	const count = isFiniteNumber(input.personalBestCount)
		? Math.max(0, Math.trunc(input.personalBestCount))
		: personalBests.length
	return {
		personalBests,
		personalBestCount: Math.max(count, personalBests.length),
		eligibleLevelP90PersonalBestCount:
			isFiniteNumber(input.eligibleLevelP90PersonalBestCount) &&
			input.eligibleLevelP90PersonalBestCount > 0
				? input.eligibleLevelP90PersonalBestCount
				: null,
		voteRating: isFiniteNumber(input.voteRating) ? clamp(input.voteRating) : null,
		matureVoteCount: isFiniteNumber(input.matureVoteCount)
			? Math.max(0, Math.trunc(input.matureVoteCount))
			: null,
	}
}

const splitDurations = (personalBest: LevelScorePersonalBest): number[] | null => {
	const splits = personalBest.splits ?? []
	if (splits.length === 0) return null
	const segments: number[] = []
	let previous = 0
	for (const split of splits) {
		if (
			!isFiniteNumber(split.time) ||
			split.time <= previous ||
			split.time > personalBest.time
		) {
			return null
		}
		segments.push(split.time - previous)
		previous = split.time
	}
	if (previous < personalBest.time) segments.push(personalBest.time - previous)
	return segments.every((segment) => segment > 0) ? segments : null
}

const toSplitProfile = (personalBest: LevelScorePersonalBest): SplitProfile | null => {
	const segments = splitDurations(personalBest)
	if (!segments) return null
	return {
		personalBest,
		segments,
		speeds: (personalBest.splits ?? []).map((split) =>
			isFiniteNumber(split.speed) ? split.speed : null,
		),
	}
}

const selectModalProfiles = (
	personalBests: readonly LevelScorePersonalBest[],
	minimumCount: number,
): SplitProfile[] | null => {
	const profiles = personalBests.flatMap((personalBest) => {
		const profile = toSplitProfile(personalBest)
		return profile ? [profile] : []
	})
	const counts = new Map<number, number>()
	for (const profile of profiles) {
		counts.set(profile.segments.length, (counts.get(profile.segments.length) ?? 0) + 1)
	}
	const segmentCount = [...counts.entries()]
		.filter(([, count]) => count >= minimumCount)
		.toSorted((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0]
	if (!segmentCount) return null
	return profiles.filter((profile) => profile.segments.length === segmentCount)
}

const theoreticalBest = (personalBests: readonly LevelScorePersonalBest[]): number | null => {
	const profiles = selectModalProfiles(
		personalBests,
		LEVEL_SCORE_V2_WORLD_RECORD.minimumComparableChallengers,
	)
	if (!profiles?.[0]) return null
	let total = 0
	for (let index = 0; index < profiles[0].segments.length; index += 1) {
		const reference = percentile(
			profiles.map((profile) => profile.segments[index] ?? Number.NaN),
			LEVEL_SCORE_V2_WORLD_RECORD.referencePercentile,
		)
		if (reference === null) return null
		total += reference
	}
	return total
}

const anomalyForLeaderCohort = (personalBests: readonly LevelScorePersonalBest[]) => {
	const leader = personalBests[0]
	if (!leader) return { leaderboardScore: 0, telemetryScore: null, excluded: false }
	const cohortSize = personalBests.findIndex((personalBest) => personalBest.time > leader.time)
	const resolvedCohortSize = cohortSize === -1 ? personalBests.length : cohortSize
	const challengers = personalBests.slice(resolvedCohortSize)
	const nextFive = challengers.slice(0, 5).map((personalBest) => personalBest.time)
	const nextFiveMean = mean(nextFive)
	const relativeAdvantage = nextFiveMean === null ? 0 : nextFiveMean / leader.time - 1
	const leaderboardScore = smoothBetween(relativeAdvantage, 0.25, 1)
	const leaderboardExcluded = nextFive.length === 5 && leader.time <= (nextFiveMean ?? 0) * 0.5
	const corroboratedBest = theoreticalBest(challengers)
	const telemetryAdvantage = corroboratedBest === null ? null : corroboratedBest / leader.time - 1
	const telemetryScore =
		telemetryAdvantage === null ? null : smoothBetween(telemetryAdvantage, 0.03, 0.15)
	return {
		leaderboardScore,
		telemetryScore,
		excluded: leaderboardExcluded || telemetryScore === 1,
	}
}

const resolveEffectivePersonalBests = (personalBests: readonly LevelScorePersonalBest[]) => {
	const actualWorldRecordAnomaly = anomalyForLeaderCohort(personalBests)
	let effectivePersonalBests = personalBests
	const excludedLeaderTimes: number[] = []
	while (effectivePersonalBests.length > 0) {
		const anomaly = anomalyForLeaderCohort(effectivePersonalBests)
		if (!anomaly.excluded) break
		const leaderTime = effectivePersonalBests[0]?.time
		if (leaderTime !== undefined) excludedLeaderTimes.push(leaderTime)
		effectivePersonalBests = effectivePersonalBests.filter(
			(personalBest) => personalBest.time !== leaderTime,
		)
	}
	return { actualWorldRecordAnomaly, excludedLeaderTimes }
}

const weightedRankTightness = (
	personalBests: readonly LevelScorePersonalBest[],
	configuration: readonly { rank: number; weight: number; halfLife: number }[],
): number => {
	const leader = personalBests[0]
	if (!leader) return 0.5
	let score = 0
	let weight = 0
	for (const item of configuration) {
		const comparison = personalBests[item.rank - 1]
		if (!comparison) continue
		score +=
			calculateLevelPointsV2Tightness(leader.time, comparison.time, item.halfLife) *
			item.weight
		weight += item.weight
	}
	return weight > 0 ? score / weight : 0.5
}

/**
 * Distinct result clusters stop fixed-duration boards receiving perfect competition credit.
 * Raw range: 0–1. Fewer than two observations return 0.5. Final leaderboard weight: 25%.
 */
const calculateInformationScore = (personalBests: readonly LevelScorePersonalBest[]): number => {
	if (personalBests.length < 2) return MISSING_V6_METRIC_SCORE
	let clusterCount = 1
	let clusterAnchor = personalBests[0]?.time ?? 0
	for (let index = 1; index < personalBests.length; index += 1) {
		const current = personalBests[index]
		if (!current) continue
		if (
			Math.log(current.time / clusterAnchor) >
			Math.log1p(LEVEL_SCORE_V2_LEADERBOARD.information.clusterTolerance)
		) {
			clusterCount += 1
			clusterAnchor = current.time
		}
	}
	const uniqueRatio = clusterCount / personalBests.length
	return smoothBetween(
		uniqueRatio,
		LEVEL_SCORE_V2_LEADERBOARD.information.minimumRatio,
		LEVEL_SCORE_V2_LEADERBOARD.information.fullRatio,
	)
}

/**
 * Corroborates a rank-5-to-field mastery gap with per-segment medians. Raw range: 0–1.
 * Missing or incompatible split evidence returns 0.5; extreme field gaps saturate at 10%.
 */
const calculateSplitMastery = (personalBests: readonly LevelScorePersonalBest[]): number => {
	if (personalBests.length < 10) return MISSING_V6_METRIC_SCORE
	const profiles = personalBests.slice(0, 10).map(toSplitProfile)
	const validProfiles = profiles.filter((profile): profile is SplitProfile => profile !== null)
	const counts = new Map<number, number>()
	for (const profile of validProfiles) {
		counts.set(profile.segments.length, (counts.get(profile.segments.length) ?? 0) + 1)
	}
	const segmentCount = [...counts.entries()].toSorted(
		(left, right) => right[1] - left[1] || right[0] - left[0],
	)[0]?.[0]
	if (!segmentCount) return MISSING_V6_METRIC_SCORE
	const elite = profiles
		.slice(0, 5)
		.filter((profile): profile is SplitProfile => profile?.segments.length === segmentCount)
	const field = profiles
		.slice(5, 10)
		.filter((profile): profile is SplitProfile => profile?.segments.length === segmentCount)
	if (elite.length < 3 || field.length < 3) return MISSING_V6_METRIC_SCORE

	const segmentScores: number[] = []
	for (let index = 0; index < segmentCount; index += 1) {
		const eliteMedian = median(elite.map((profile) => profile.segments[index] ?? Number.NaN))
		const fieldMedian = median(field.map((profile) => profile.segments[index] ?? Number.NaN))
		if (!eliteMedian || !fieldMedian || fieldMedian < eliteMedian) {
			segmentScores.push(0)
			continue
		}
		const gap = Math.log(fieldMedian / eliteMedian)
		segmentScores.push(
			smoothBetween(
				gap,
				Math.log1p(LEVEL_SCORE_V2_LEADERBOARD.mastery.minimumSegmentGap),
				Math.log1p(LEVEL_SCORE_V2_LEADERBOARD.mastery.maximumSegmentGap),
			),
		)
	}
	return median(segmentScores) ?? MISSING_V6_METRIC_SCORE
}

/**
 * Competitive shape combines elite tightness, top-ten depth, challenge-level mastery and
 * independently clustered result information. Raw range: 0–1; factor range: 0.55–1.
 */
const calculateLeaderboard = (personalBests: readonly LevelScorePersonalBest[]) => {
	const scoreSample = personalBests.slice(0, SCORE_SAMPLE_LIMIT)
	const frontier = weightedRankTightness(scoreSample, LEVEL_SCORE_V2_LEADERBOARD.frontier)
	const depth = weightedRankTightness(scoreSample, LEVEL_SCORE_V2_LEADERBOARD.depth)
	const information = calculateInformationScore(scoreSample)
	let mastery: number | null = null
	if (scoreSample.length >= 10) {
		const rankFive = scoreSample[4]
		const fieldTime = median(scoreSample.slice(5, 10).map((personalBest) => personalBest.time))
		if (rankFive && fieldTime !== null && fieldTime >= rankFive.time) {
			const separation = smoothBetween(
				Math.log(fieldTime / rankFive.time),
				Math.log1p(LEVEL_SCORE_V2_LEADERBOARD.mastery.minimumFieldGap),
				Math.log1p(LEVEL_SCORE_V2_LEADERBOARD.mastery.maximumFieldGap),
			)
			mastery = Math.cbrt(frontier * separation * calculateSplitMastery(scoreSample))
		}
	}
	const weights = LEVEL_SCORE_V2_LEADERBOARD.weights
	const score = clamp(
		weights.frontier * frontier +
			weights.depthOrMastery * Math.max(depth, mastery ?? depth) +
			weights.information * information,
	)
	return {
		score,
		factor: interpolate(
			LEVEL_SCORE_V2_LEADERBOARD.factor.minimum,
			LEVEL_SCORE_V2_LEADERBOARD.factor.maximum,
			score,
		),
	}
}

const leaderCohort = (personalBests: readonly LevelScorePersonalBest[]) => {
	const leaderTime = personalBests[0]?.time
	return leaderTime === undefined
		? []
		: personalBests.filter((personalBest) => personalBest.time === leaderTime)
}

const percentileRank = (
	value: number,
	comparisons: readonly number[],
	direction: 'higher' | 'lower',
): number => {
	if (comparisons.length === 0) return MISSING_V6_METRIC_SCORE
	let better = 0
	let equal = 0
	for (const comparison of comparisons) {
		if (approximatelyEqual(value, comparison)) equal += 1
		else if (direction === 'higher' ? value > comparison : value < comparison) better += 1
	}
	return clamp((better + equal * 0.5) / comparisons.length)
}

/**
 * Scores WR optimization, segment dominance and checkpoint-speed conversion. Raw range: 0–1;
 * factor range: 0.75–1. Each unavailable component returns 0.5 instead of being reweighted away.
 */
const calculateWorldRecord = (
	personalBests: readonly LevelScorePersonalBest[],
): WorldRecordAnalysis => {
	const leaders = leaderCohort(personalBests)
	const leader = leaders[0]
	if (!leader) {
		return { score: 0, optimizationRatio: null, speedConversion: null }
	}
	const challengers = personalBests.slice(leaders.length, SCORE_SAMPLE_LIMIT)
	const challengerProfiles = selectModalProfiles(
		challengers,
		LEVEL_SCORE_V2_WORLD_RECORD.minimumComparableChallengers,
	)
	if (!challengerProfiles?.[0]) {
		return {
			score: MISSING_V6_METRIC_SCORE,
			optimizationRatio: null,
			speedConversion: null,
		}
	}
	const segmentCount = challengerProfiles[0].segments.length
	const leaderProfiles = leaders
		.map(toSplitProfile)
		.filter((profile): profile is SplitProfile => profile?.segments.length === segmentCount)

	const references: number[] = []
	for (let index = 0; index < segmentCount; index += 1) {
		const reference = percentile(
			challengerProfiles.map((profile) => profile.segments[index] ?? Number.NaN),
			LEVEL_SCORE_V2_WORLD_RECORD.referencePercentile,
		)
		if (reference === null) break
		references.push(reference)
	}
	const corroboratedBest = references.reduce((sum, value) => sum + value, 0)
	const optimizationRatio =
		references.length === segmentCount && corroboratedBest > 0
			? clamp(corroboratedBest / leader.time)
			: null
	const optimization =
		optimizationRatio === null
			? MISSING_V6_METRIC_SCORE
			: calculateLevelPointsV2Tightness(
					Math.min(corroboratedBest, leader.time),
					leader.time,
					LEVEL_SCORE_V2_WORLD_RECORD.optimizationHalfLife,
				)

	let dominance = MISSING_V6_METRIC_SCORE
	if (leaderProfiles.length > 0 && references.length === segmentCount) {
		const weighted: number[] = []
		const weights: number[] = []
		for (let index = 0; index < segmentCount; index += 1) {
			const leaderSegment = median(
				leaderProfiles.map((profile) => profile.segments[index] ?? Number.NaN),
			)
			const reference = references[index]
			if (leaderSegment === null || reference === undefined) continue
			weighted.push(
				percentileRank(
					leaderSegment,
					challengerProfiles.map((profile) => profile.segments[index] ?? Number.NaN),
					'lower',
				),
			)
			weights.push(reference)
		}
		const weightTotal = weights.reduce((sum, value) => sum + value, 0)
		if (weightTotal > 0) {
			dominance = weighted.reduce(
				(sum, value, index) => sum + value * ((weights[index] ?? 0) / weightTotal),
				0,
			)
		}
	}

	let speedConversion: number | null = null
	if (leaderProfiles.length > 0 && references.length === segmentCount) {
		let weightedTotal = 0
		let weightTotal = 0
		for (let index = 0; index < segmentCount - 1; index += 1) {
			const leaderSpeed = median(
				leaderProfiles.map((profile) => profile.speeds[index] ?? Number.NaN),
			)
			const leaderFollowingSegment = median(
				leaderProfiles.map((profile) => profile.segments[index + 1] ?? Number.NaN),
			)
			if (leaderSpeed === null || leaderFollowingSegment === null) continue
			const comparable = challengerProfiles.filter(
				(profile) =>
					isFiniteNumber(profile.speeds[index]) &&
					isFiniteNumber(profile.segments[index + 1]),
			)
			if (comparable.length < LEVEL_SCORE_V2_WORLD_RECORD.minimumComparableChallengers)
				continue
			const speed = percentileRank(
				leaderSpeed,
				comparable.map((profile) => profile.speeds[index] ?? Number.NaN),
				'higher',
			)
			const followingTime = percentileRank(
				leaderFollowingSegment,
				comparable.map((profile) => profile.segments[index + 1] ?? Number.NaN),
				'lower',
			)
			const converted =
				speed + followingTime === 0
					? 0
					: (2 * speed * followingTime) / (speed + followingTime)
			const weight = references[index + 1] ?? 0
			weightedTotal += converted * weight
			weightTotal += weight
		}
		if (weightTotal > 0) speedConversion = weightedTotal / weightTotal
	}

	const weights = LEVEL_SCORE_V2_WORLD_RECORD.weights
	const score = clamp(
		weights.optimization * optimization +
			weights.dominance * dominance +
			weights.speedConversion * (speedConversion ?? MISSING_V6_METRIC_SCORE),
	)
	return { score, optimizationRatio, speedConversion }
}

/**
 * Converts credible sample count into evidence confidence. Confidence reaches 1 at ten PBs;
 * factor range: 0.1–1. Lifetime PB count never affects this signal.
 */
const calculateEvidence = (credibleSampleSize: number) => {
	const confidence = smoothstep(
		(Math.min(credibleSampleSize, LEVEL_SCORE_V2_EVIDENCE.fullSampleSize) - 1) /
			(LEVEL_SCORE_V2_EVIDENCE.fullSampleSize - 1),
	)
	return {
		confidence,
		factor: interpolate(LEVEL_SCORE_V2_EVIDENCE.minimumFactor, 1, confidence),
	}
}

/**
 * Applies bounded lifetime-popularity evidence. Raw score range: 0–1; factor range: 0.95–1.
 * Missing P90 reference is neutral so absence of global calibration never penalizes a level.
 */
const calculatePopularity = (personalBestCount: number, p90Reference: number | null) => {
	const score =
		p90Reference === null
			? null
			: clamp(Math.log1p(personalBestCount) / Math.log1p(p90Reference))
	return {
		score,
		factor:
			score === null
				? 1
				: interpolate(
						LEVEL_SCORE_V2_POPULARITY.minimumFactor,
						LEVEL_SCORE_V2_POPULARITY.maximumFactor,
						score,
					),
	}
}

/**
 * Mature vote adjustment remains deliberately small. Factor range: 0.97–1.03; no mature
 * votes or missing rating is neutral 1. Vote signal is only score component able to exceed 1.
 */
const calculateVoteFactor = (rating: number | null, matureVoteCount: number | null): number =>
	matureVoteCount === 0 || rating === null
		? 1
		: interpolate(LEVEL_SCORE_V2_VOTE.minimumFactor, LEVEL_SCORE_V2_VOTE.maximumFactor, rating)

/**
 * Checkpoint execution combines route-share repeatability and per-segment competition.
 * Raw range: 0–1; factor range: 0.85–1. Missing split evidence uses 0.5.
 */
const calculateExecution = (
	personalBests: readonly LevelScorePersonalBest[],
): ExecutionAnalysis => {
	const profiles = selectModalProfiles(
		personalBests.slice(0, SCORE_SAMPLE_LIMIT),
		LEVEL_SCORE_V2_EXECUTION.minimumComparableRuns,
	)
	if (!profiles?.[0]) {
		return { score: MISSING_V6_METRIC_SCORE, routeConsistency: null }
	}
	const segmentCount = profiles[0].segments.length
	const routeShares = profiles.map((profile) =>
		profile.segments.map((segment) => segment / profile.personalBest.time),
	)
	const centers = Array.from(
		{ length: segmentCount },
		(_, index) => median(routeShares.map((route) => route[index] ?? Number.NaN)) ?? 0,
	)
	const deviations = routeShares.map(
		(route) =>
			0.5 *
			route.reduce((sum, value, index) => sum + Math.abs(value - (centers[index] ?? 0)), 0),
	)
	const routeConsistency =
		1 -
		clamp(
			(median(deviations) ?? LEVEL_SCORE_V2_EXECUTION.routeDeviationTolerance) /
				LEVEL_SCORE_V2_EXECUTION.routeDeviationTolerance,
		)

	const medianSegments = Array.from(
		{ length: segmentCount },
		(_, index) => median(profiles.map((profile) => profile.segments[index] ?? Number.NaN)) ?? 0,
	)
	const medianTotal = medianSegments.reduce((sum, value) => sum + value, 0)
	let segmentCompetition = MISSING_V6_METRIC_SCORE
	if (medianTotal > 0) {
		segmentCompetition = medianSegments.reduce((total, segmentMedian, index) => {
			if (segmentMedian <= 0) return total
			const deviation =
				median(
					profiles.map((profile) =>
						Math.abs((profile.segments[index] ?? segmentMedian) - segmentMedian),
					),
				) ?? 0
			const relativeMad = deviation / segmentMedian
			const tightness =
				2 ** (-relativeMad / Math.log1p(LEVEL_SCORE_V2_EXECUTION.segmentMadHalfLife))
			return total + tightness * (segmentMedian / medianTotal)
		}, 0)
	}
	const weights = LEVEL_SCORE_V2_EXECUTION.weights
	return {
		score: clamp(
			weights.route * routeConsistency + weights.segmentCompetition * segmentCompetition,
		),
		routeConsistency,
	}
}

const getSteeringRuns = (personalBests: readonly LevelScorePersonalBest[]): SteeringRun[] => {
	const runs: SteeringRun[] = []
	for (const [index, personalBest] of personalBests.entries()) {
		const telemetry = personalBest.telemetry
		if (telemetry?.hasInputData !== true || !hasExtendedTelemetry(telemetry)) continue
		const duration =
			isFiniteNumber(telemetry.time) && telemetry.time > 0
				? telemetry.time
				: personalBest.time
		const values = [
			telemetry.turnLeftTime,
			telemetry.turnRightTime,
			telemetry.turnLeftCount,
			telemetry.turnRightCount,
		]
		if (!values.every(isFiniteNumber)) continue
		const steeringShare = clamp(
			((telemetry.turnLeftTime ?? 0) + (telemetry.turnRightTime ?? 0)) / duration,
		)
		const steeringTransitionCount = Math.max(
			0,
			(telemetry.turnLeftCount ?? 0) + (telemetry.turnRightCount ?? 0),
		)
		const steeringTransitionRate = steeringTransitionCount / duration
		const engagement = Math.max(
			smoothBetween(
				steeringShare,
				LEVEL_SCORE_V2_TELEMETRY.steeringShare.minimum,
				LEVEL_SCORE_V2_TELEMETRY.steeringShare.maximum,
			),
			smoothBetween(
				steeringTransitionRate,
				LEVEL_SCORE_V2_TELEMETRY.steeringTransitionRate.minimum,
				LEVEL_SCORE_V2_TELEMETRY.steeringTransitionRate.maximum,
			),
		)
		runs.push({
			rank: index + 1,
			time: personalBest.time,
			steeringShare,
			steeringTransitionCount,
			steeringTransitionRate,
			engagement,
			lowSteering:
				steeringShare <= LEVEL_SCORE_V2_TELEMETRY.lowSteeringShare &&
				steeringTransitionCount <= LEVEL_SCORE_V2_TELEMETRY.lowSteeringTransitions,
		})
	}
	return runs
}

const coverageBlend = (observed: number, validSamples: number, targetSamples: number): number => {
	if (targetSamples <= 0) return MISSING_V6_METRIC_SCORE
	const confidence = smoothstep(validSamples / targetSamples)
	return MISSING_V6_METRIC_SCORE + confidence * (observed - MISSING_V6_METRIC_SCORE)
}

const consistency = (values: readonly number[], tolerance: number): number | null => {
	if (values.length < LEVEL_SCORE_V2_TELEMETRY.minimumComparableRuns) return null
	const center = median(values)
	if (center === null || center <= 0) return null
	const deviation = median(values.map((value) => Math.abs(value - center))) ?? 0
	return 1 - clamp(deviation / center / tolerance)
}

/**
 * Capability-backed telemetry uses steering only for control engagement. Arms-up, braking,
 * union-input time and combined input transitions are intentionally excluded from every factor.
 * Raw range: 0–1; factor range: 0.8–1; missing evidence uses 0.5 and therefore factor 0.9.
 */
const calculateTelemetry = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
) => {
	const sample = personalBests.slice(0, SCORE_SAMPLE_LIMIT)
	const targetSamples = sample.length
	const steeringRuns = getSteeringRuns(sample)
	const engagementObserved =
		steeringRuns.length > 0
			? 0.6 * (median(steeringRuns.map((run) => run.engagement)) ?? 0) +
				0.4 *
					(percentile(
						steeringRuns.map((run) => run.engagement),
						0.25,
					) ?? 0)
			: MISSING_V6_METRIC_SCORE
	const lowSteeringRuns = steeringRuns.filter((run) => run.lowSteering)
	const bestLowSteering = lowSteeringRuns.toSorted((left, right) => left.time - right.time)[0]
	const bestCloseness = bestLowSteering
		? calculateLevelPointsV2Tightness(leaderTime, bestLowSteering.time, 0.02)
		: 0
	const lowSteeringShare =
		steeringRuns.length > 0 ? lowSteeringRuns.length / steeringRuns.length : 0
	const passiveSeverityObserved = clamp(0.6 * bestCloseness + 0.4 * lowSteeringShare)
	const antiPassiveObserved = 1 - passiveSeverityObserved

	const distances = sample.flatMap(({ telemetry }) =>
		hasExtendedTelemetry(telemetry) &&
		isFiniteNumber(telemetry?.distance) &&
		telemetry.distance > 0
			? [telemetry.distance]
			: [],
	)
	const averageSpeeds = sample.flatMap(({ telemetry }) =>
		hasExtendedTelemetry(telemetry) &&
		telemetry?.hasVelocityData === true &&
		isFiniteNumber(telemetry.averageSpeed) &&
		telemetry.averageSpeed > 0
			? [telemetry.averageSpeed]
			: [],
	)
	const distanceObserved = consistency(distances, LEVEL_SCORE_V2_TELEMETRY.distanceMadTolerance)
	const speedObserved = consistency(
		averageSpeeds,
		LEVEL_SCORE_V2_TELEMETRY.averageSpeedMadTolerance,
	)
	const engagement = coverageBlend(engagementObserved, steeringRuns.length, targetSamples)
	const antiPassive = coverageBlend(antiPassiveObserved, steeringRuns.length, targetSamples)
	const distance = coverageBlend(
		distanceObserved ?? MISSING_V6_METRIC_SCORE,
		distances.length,
		targetSamples,
	)
	const averageSpeed = coverageBlend(
		speedObserved ?? MISSING_V6_METRIC_SCORE,
		averageSpeeds.length,
		targetSamples,
	)
	const weights = LEVEL_SCORE_V2_TELEMETRY.weights
	const score = clamp(
		weights.steeringEngagement * engagement +
			weights.antiPassive * antiPassive +
			weights.distanceConsistency * distance +
			weights.averageSpeedConsistency * averageSpeed,
	)
	return {
		score,
		factor: interpolate(
			LEVEL_SCORE_V2_TELEMETRY.factor.minimum,
			LEVEL_SCORE_V2_TELEMETRY.factor.maximum,
			score,
		),
		steeringRuns,
		engagementObserved: steeringRuns.length > 0 ? engagementObserved : null,
		passiveSeverityObserved: steeringRuns.length > 0 ? passiveSeverityObserved : null,
		distanceObserved,
		speedObserved,
	}
}

const parseDate = (value: Date | string | null | undefined): number | null => {
	if (!value) return null
	const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
	return Number.isFinite(timestamp) ? timestamp : null
}

const calculateChallengers = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
): number | null => {
	const leaderDate = parseDate(personalBests[0]?.dateCreated)
	if (leaderDate === null) return null
	return personalBests.slice(1).filter((personalBest) => {
		const date = parseDate(personalBest.dateCreated)
		return date !== null && date > leaderDate && personalBest.time <= leaderTime * 1.05
	}).length
}

const capabilityCount = (
	personalBests: readonly LevelScorePersonalBest[],
	flag: keyof LevelScoreTelemetry,
): number => personalBests.filter(({ telemetry }) => telemetry?.[flag] === true).length

const emptyTelemetryCounts = (): LevelScoreTelemetrySampleCounts => ({
	input: 0,
	air: 0,
	wheel: 0,
	slip: 0,
	state: 0,
	surface: 0,
	velocity: 0,
	ragdoll: 0,
})

const typicalTelemetryValue = (
	personalBests: readonly LevelScorePersonalBest[],
	capability: keyof LevelScoreTelemetry | null,
	field: keyof LevelScoreTelemetry,
): number | null =>
	median(
		personalBests.flatMap(({ telemetry }) => {
			if (!telemetry || (capability !== null && telemetry[capability] !== true)) return []
			const value = telemetry[field]
			return isFiniteNumber(value) ? [value] : []
		}),
	)

const typicalTelemetryShare = (
	personalBests: readonly LevelScorePersonalBest[],
	capability: keyof LevelScoreTelemetry,
	field: keyof LevelScoreTelemetry,
): number | null =>
	median(
		personalBests.flatMap(({ time, telemetry }) => {
			if (telemetry?.[capability] !== true) return []
			const value = telemetry[field]
			const duration = telemetry.time ?? time
			return isFiniteNumber(value) && isFiniteNumber(duration) && duration > 0
				? [clamp(value / duration)]
				: []
		}),
	)

const calculateSurfaceDiversity = (
	personalBests: readonly LevelScorePersonalBest[],
): number | null => {
	const fields = [
		'timeOnTarmac',
		'timeOnGrass',
		'timeOnSand',
		'timeOnIce',
		'timeOnMetal',
		'timeOnSnow',
		'timeOnSoap',
	] as const
	const totals = fields.map((field) =>
		personalBests.reduce((total, { telemetry }) => {
			if (telemetry?.hasSurfaceData !== true) return total
			const value = telemetry[field]
			return total + (isFiniteNumber(value) && value > 0 ? value : 0)
		}, 0),
	)
	const total = totals.reduce((sum, value) => sum + value, 0)
	if (total <= 0) return null
	const entropy = totals.reduce((sum, value) => {
		if (value <= 0) return sum
		const share = value / total
		return sum - share * Math.log(share)
	}, 0)
	return clamp(entropy / Math.log(fields.length))
}

const spreadAtRank = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
	rank: number,
): number | null => {
	const personalBest = personalBests[rank - 1]
	return personalBest ? personalBest.time / leaderTime - 1 : null
}

const emptyResult = (normalized: NormalizedInput): LevelScoreResult => {
	const factors: LevelScoreFactors = {
		lengthFactor: 1,
		competitiveMerit: 0.5,
		participationFactor: 0.75,
		voteFactor: 1,
		passivePlayFactor: 1,
	}
	return {
		points: 0,
		factors,
		modifiers: {
			lengthModifier: factors.lengthFactor,
			competitivenessModifier: 0.1 + 1.9 * factors.competitiveMerit,
			ratingModifier: factors.voteFactor,
			popularityModifier: factors.participationFactor,
			cutPenalty: 1,
		},
		metrics: {
			sampleSize: 0,
			personalBestCount: normalized.personalBestCount,
			leaderboardConfidence: 0,
			competitivenessScore: null,
			worldRecordDifficultyScore: null,
			participationScore: normalized.eligibleLevelP90PersonalBestCount === null ? null : 0,
			matureVoteCount: normalized.matureVoteCount,
			airSampleSize: 0,
			stateSampleSize: 0,
			surfaceSampleSize: 0,
			velocitySampleSize: 0,
			wheelSampleSize: 0,
			slipSampleSize: 0,
			ragdollSampleSize: 0,
			inputSampleSize: 0,
			inputCoverage: null,
			passivePlaySeverity: null,
			afkModifier: null,
			passiveRunRatio: null,
			passiveTop10Share: null,
			bestPassiveRank: null,
			bestPassiveGap: null,
			driverEngagementScore: null,
			worldRecordMargin: null,
			top5Spread: null,
			top10Spread: null,
			top50Spread: null,
			wrChallengerCount: null,
			worldRecordOptimizationScore: null,
			leaderboardAnomalyScore: null,
			telemetryAnomalyScore: null,
			worldRecordExcluded: null,
			pathConsistencyScore: null,
			speedConsistencyScore: null,
			routeConsistencyScore: null,
			surfaceDiversityScore: null,
			medianSteeringShare: null,
			q25SteeringShare: null,
			lowSteeringRatio: null,
			zeroControlRatio: null,
			medianBrakeShare: null,
			medianArmsUpShare: null,
			medianControlTransitionRate: null,
			typicalDistance: null,
			typicalAverageSpeed: null,
			typicalMaxSpeed: null,
			typicalAirTimeShare: null,
			typicalGroundTimeShare: null,
			typicalSlipShare: null,
			typicalRagdollShare: null,
			typicalAverageAngularVelocity: null,
			typicalAverageGforce: null,
			telemetrySampleCounts: emptyTelemetryCounts(),
		},
	}
}

/**
 * Alternative level score model. All quality signals are bounded multipliers applied to a
 * 9,984-point ceiling. Total popularity affects at most 5%; steering telemetry affects at most
 * 20%; arms-up and braking never affect points. Output remains V1-compatible.
 */
export function calculateLevelPointsV2(
	input: LevelScoreInput | LegacyLevelScoreInput,
): LevelScoreResult {
	const normalized = normalizeInput(input)
	const allPersonalBests = normalized.personalBests
		.map((personalBest) => ({ personalBest, key: canonicalPersonalBestKey(personalBest) }))
		.toSorted(
			(left, right) =>
				left.personalBest.time - right.personalBest.time ||
				(left.key === right.key ? 0 : left.key < right.key ? -1 : 1),
		)
		.slice(0, LEVEL_SCORE_PERSONAL_BEST_LIMIT)
		.map(({ personalBest }) => personalBest)
	if (allPersonalBests.length === 0) return emptyResult(normalized)

	const { actualWorldRecordAnomaly: anomaly, excludedLeaderTimes } =
		resolveEffectivePersonalBests(allPersonalBests.slice(0, SCORE_SAMPLE_LIMIT))
	const excludedLeaderTimeSet = new Set(excludedLeaderTimes)
	const personalBests = allPersonalBests.filter(
		(personalBest) => !excludedLeaderTimeSet.has(personalBest.time),
	)
	const leader = personalBests[0]
	if (!leader) return emptyResult(normalized)

	const scoreSample = personalBests.slice(0, SCORE_SAMPLE_LIMIT)
	const leaderboard = calculateLeaderboard(scoreSample)
	const worldRecord = calculateWorldRecord(scoreSample)
	const execution = calculateExecution(scoreSample)
	const telemetry = calculateTelemetry(scoreSample, leader.time)
	const lengthFactor = calculateLevelPointsV2LengthFactor(
		median(scoreSample.map((personalBest) => personalBest.time)),
	)
	const evidence = calculateEvidence(personalBests.length)
	const popularity = calculatePopularity(
		normalized.personalBestCount,
		normalized.eligibleLevelP90PersonalBestCount,
	)
	const voteFactor = calculateVoteFactor(normalized.voteRating, normalized.matureVoteCount)
	const competitiveMerit =
		leaderboard.factor *
		interpolate(
			LEVEL_SCORE_V2_WORLD_RECORD.factor.minimum,
			LEVEL_SCORE_V2_WORLD_RECORD.factor.maximum,
			worldRecord.score,
		) *
		interpolate(
			LEVEL_SCORE_V2_EXECUTION.factor.minimum,
			LEVEL_SCORE_V2_EXECUTION.factor.maximum,
			execution.score,
		)
	const participationFactor = evidence.factor * popularity.factor
	const factors: LevelScoreFactors = {
		lengthFactor,
		competitiveMerit,
		participationFactor,
		voteFactor,
		passivePlayFactor: telemetry.factor,
	}
	const rawPoints =
		MAX_LEVEL_POINTS *
		factors.lengthFactor *
		factors.competitiveMerit *
		factors.participationFactor *
		factors.voteFactor *
		factors.passivePlayFactor
	const points = ceilLevelPointsV2(rawPoints)

	const allSteeringRuns = getSteeringRuns(personalBests)
	const inputCoverage =
		personalBests.length > 0 ? allSteeringRuns.length / personalBests.length : null
	const lowSteeringRuns = allSteeringRuns.filter((run) => run.lowSteering)
	const bestLowSteering = lowSteeringRuns.toSorted((left, right) => left.time - right.time)[0]
	const telemetryCounts: LevelScoreTelemetrySampleCounts = {
		input: allSteeringRuns.length,
		air: capabilityCount(personalBests, 'hasAirData'),
		wheel: capabilityCount(personalBests, 'hasWheelData'),
		slip: capabilityCount(personalBests, 'hasSlipData'),
		state: capabilityCount(personalBests, 'hasStateData'),
		surface: capabilityCount(personalBests, 'hasSurfaceData'),
		velocity: capabilityCount(personalBests, 'hasVelocityData'),
		ragdoll: capabilityCount(personalBests, 'hasRagdollData'),
	}
	const distances = personalBests.flatMap(({ telemetry: item }) =>
		isFiniteNumber(item?.distance) ? [item.distance] : [],
	)
	const averageSpeeds = personalBests.flatMap(({ telemetry: item }) =>
		isFiniteNumber(item?.averageSpeed) ? [item.averageSpeed] : [],
	)
	const descriptiveBrakeShares = personalBests.flatMap(({ time, telemetry: item }) => {
		if (item?.hasInputData !== true || !isFiniteNumber(item.brakeTime)) return []
		const duration = isFiniteNumber(item.time) && item.time > 0 ? item.time : time
		return [clamp(item.brakeTime / duration)]
	})
	const descriptiveArmsUpShares = personalBests.flatMap(({ time, telemetry: item }) => {
		if (item?.hasInputData !== true || !isFiniteNumber(item.armsUpTime)) return []
		const duration = isFiniteNumber(item.time) && item.time > 0 ? item.time : time
		return [clamp(item.armsUpTime / duration)]
	})
	const descriptiveTransitionRates = personalBests.flatMap(({ time, telemetry: item }) => {
		if (item?.hasInputData !== true || !isFiniteNumber(item.driverInputTransitionCount))
			return []
		const duration = isFiniteNumber(item.time) && item.time > 0 ? item.time : time
		return [Math.max(0, item.driverInputTransitionCount) / duration]
	})

	return {
		points,
		factors,
		modifiers: {
			lengthModifier: factors.lengthFactor,
			competitivenessModifier: 0.1 + 1.9 * factors.competitiveMerit,
			ratingModifier: factors.voteFactor,
			popularityModifier: factors.participationFactor,
			cutPenalty: 1,
		},
		metrics: {
			sampleSize: personalBests.length,
			personalBestCount: normalized.personalBestCount,
			leaderboardConfidence: evidence.confidence,
			competitivenessScore: leaderboard.score,
			worldRecordDifficultyScore: worldRecord.score,
			participationScore: popularity.score,
			matureVoteCount: normalized.matureVoteCount,
			airSampleSize: telemetryCounts.air,
			stateSampleSize: telemetryCounts.state,
			surfaceSampleSize: telemetryCounts.surface,
			velocitySampleSize: telemetryCounts.velocity,
			wheelSampleSize: telemetryCounts.wheel,
			slipSampleSize: telemetryCounts.slip,
			ragdollSampleSize: telemetryCounts.ragdoll,
			inputSampleSize: allSteeringRuns.length,
			inputCoverage,
			passivePlaySeverity: telemetry.passiveSeverityObserved,
			afkModifier: telemetry.factor,
			passiveRunRatio:
				allSteeringRuns.length > 0 ? lowSteeringRuns.length / allSteeringRuns.length : null,
			passiveTop10Share:
				telemetry.steeringRuns.length > 0
					? telemetry.steeringRuns.filter((run) => run.lowSteering).length /
						telemetry.steeringRuns.length
					: null,
			bestPassiveRank: bestLowSteering?.rank ?? null,
			bestPassiveGap: bestLowSteering ? bestLowSteering.time / leader.time - 1 : null,
			driverEngagementScore: telemetry.engagementObserved,
			worldRecordMargin:
				allPersonalBests[0] && allPersonalBests[1]
					? allPersonalBests[1].time / allPersonalBests[0].time - 1
					: null,
			top5Spread: spreadAtRank(personalBests, leader.time, 5),
			top10Spread: spreadAtRank(personalBests, leader.time, 10),
			top50Spread: spreadAtRank(personalBests, leader.time, 50),
			wrChallengerCount: calculateChallengers(personalBests, leader.time),
			worldRecordOptimizationScore: worldRecord.optimizationRatio,
			leaderboardAnomalyScore: anomaly.leaderboardScore,
			telemetryAnomalyScore: anomaly.telemetryScore,
			worldRecordExcluded: anomaly.excluded,
			pathConsistencyScore: telemetry.distanceObserved,
			speedConsistencyScore: worldRecord.speedConversion,
			routeConsistencyScore: execution.routeConsistency,
			surfaceDiversityScore: calculateSurfaceDiversity(personalBests),
			medianSteeringShare: median(allSteeringRuns.map((run) => run.steeringShare)),
			q25SteeringShare: percentile(
				allSteeringRuns.map((run) => run.steeringShare),
				0.25,
			),
			lowSteeringRatio:
				allSteeringRuns.length > 0
					? allSteeringRuns.filter(
							(run) =>
								run.steeringShare <= LEVEL_SCORE_V2_TELEMETRY.steeringShare.minimum,
						).length / allSteeringRuns.length
					: null,
			zeroControlRatio:
				allSteeringRuns.length > 0
					? allSteeringRuns.filter(
							(run) => run.steeringShare === 0 && run.steeringTransitionCount === 0,
						).length / allSteeringRuns.length
					: null,
			medianBrakeShare: median(descriptiveBrakeShares),
			medianArmsUpShare: median(descriptiveArmsUpShares),
			medianControlTransitionRate: median(descriptiveTransitionRates),
			typicalDistance: median(distances),
			typicalAverageSpeed: median(averageSpeeds),
			typicalMaxSpeed: typicalTelemetryValue(personalBests, null, 'maxSpeed'),
			typicalAirTimeShare: typicalTelemetryShare(personalBests, 'hasAirData', 'timeInAir'),
			typicalGroundTimeShare: typicalTelemetryShare(
				personalBests,
				'hasAirData',
				'timeOnGround',
			),
			typicalSlipShare: typicalTelemetryShare(personalBests, 'hasSlipData', 'timeSlipping'),
			typicalRagdollShare: typicalTelemetryShare(
				personalBests,
				'hasRagdollData',
				'timeRagdoll',
			),
			typicalAverageAngularVelocity: typicalTelemetryValue(
				personalBests,
				'hasVelocityData',
				'averageAngularVelocity',
			),
			typicalAverageGforce: typicalTelemetryValue(
				personalBests,
				'hasVelocityData',
				'averageGforce',
			),
			telemetrySampleCounts: telemetryCounts,
		},
	}
}
