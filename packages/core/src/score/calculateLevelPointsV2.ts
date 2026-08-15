export const MAX_LEVEL_POINTS = 9_984
export const LEVEL_SCORE_PERSONAL_BEST_LIMIT = 20

export interface LevelScoreSplit {
	/** Cumulative checkpoint time. Finish time is added from personal best time. */
	time: number
}

export interface LevelScoreTelemetry {
	armsUpCount?: number | null
	armsUpTime?: number | null
	brakeCount?: number | null
	brakeTime?: number | null
	driverInputTransitionCount?: number | null
	hasInputData?: boolean | null
	time?: number | null
	turnLeftCount?: number | null
	turnLeftTime?: number | null
	turnRightCount?: number | null
	turnRightTime?: number | null
}

export interface LevelScorePersonalBest {
	splits?: readonly LevelScoreSplit[] | null
	telemetry?: LevelScoreTelemetry | null
	time: number
}

export interface LevelScoreSkillMetrics {
	alignment: number | null
	fieldStrength: number | null
	ratedPlayerCount: number
	separation: number | null
}

export interface LevelScoreInput {
	matureVoteCount?: number
	/** Total current PB count, including entries outside supplied top 20. */
	personalBestCount?: number
	/** Best current personal bests. More than 20 entries are ignored. */
	personalBests: readonly LevelScorePersonalBest[]
	/** Independent cross-map player-skill observations for this level. */
	skill?: LevelScoreSkillMetrics | null
	voteRating?: number | null
}

export interface LevelScoreFactors {
	evidenceFactor: number
	lengthFactor: number
	qualityFactor: number
	voteFactor: number
}

export interface LevelScoreMetrics {
	complexityConfidence: number | null
	complexityScore: number | null
	fieldStrength: number | null
	qualityScore: number | null
	skillAlignment: number | null
	skillConfidence: number | null
	skillSampleSize: number | null
	skillScore: number | null
	skillSeparation: number | null
}

export interface LevelScoreModifiers {
	evidenceModifier: number
	lengthModifier: number
	qualityModifier: number
	ratingModifier: number
}

export interface LevelScoreResult {
	factors: LevelScoreFactors
	metrics: LevelScoreMetrics
	modifiers: LevelScoreModifiers
	points: number
}

interface NormalizedLevelScoreInput {
	matureVoteCount: number | null
	personalBestCount: number
	voteRating: number | null
}

interface PreparedLevelScoreInput {
	allPersonalBests: LevelScorePersonalBest[]
	normalized: NormalizedLevelScoreInput
	personalBests: LevelScorePersonalBest[]
}

export const LEVEL_SCORE_V2_COMPLEXITY = {
	sampleLimit: 20,
	minimumComparableRuns: 3,
	fullComparableRuns: 10,
	primaryControlShare: { minimum: 0.15, maximum: 0.63 },
	transitionRate: { minimum: 0.73, maximum: 1.89 },
} as const

export const LEVEL_SCORE_V2_SKILL = {
	alignment: { minimum: 0.45, maximum: 0.85 },
	separation: { minimum: 0.005, maximum: 0.07 },
	fieldStrength: { minimum: 0.6, maximum: 0.8 },
	minimumRatedPlayers: 8,
	fullRatedPlayers: 64,
} as const

export const LEVEL_SCORE_V2_EVIDENCE = {
	minimumFactor: 0.1,
	minimumPersonalBests: 3,
	fullPersonalBests: 16,
} as const

export const LEVEL_SCORE_V2_QUALITY = {
	minimumFactor: 0.1,
	complexityWeight: 0.55,
	skillWeight: 0.45,
} as const

export const LEVEL_SCORE_V2_POINTS = {
	minimum: 2,
	maximum: MAX_LEVEL_POINTS,
} as const

interface ComplexityRun {
	primaryControlShare: number
	runComplexity: number
	transitionRate: number
}

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

const clamp = (value: number, minimum = 0, maximum = 1): number =>
	Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : minimum

const smoothstep = (value: number): number => {
	const bounded = clamp(value)
	return bounded * bounded * (3 - 2 * bounded)
}

const smoothstepBetween = (value: number, minimum: number, maximum: number): number =>
	maximum > minimum ? smoothstep((value - minimum) / (maximum - minimum)) : 0

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

const mean = (values: readonly number[]): number | null =>
	values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null

export const calculateLevelPointsV2LengthFactor = (medianTopTenTime: number | null): number => {
	if (!isFiniteNumber(medianTopTenTime) || medianTopTenTime <= 0) return 0
	if (medianTopTenTime < 5) return 0.35
	if (medianTopTenTime < 20) {
		return 0.35 + 0.65 * smoothstepBetween(medianTopTenTime, 5, 20)
	}
	if (medianTopTenTime <= 180) return 1
	if (medianTopTenTime < 600) {
		return 1 - 0.25 * smoothstepBetween(medianTopTenTime, 180, 600)
	}
	return 0.75
}

const splitDurations = (personalBest: LevelScorePersonalBest): number[] | null => {
	const cumulativeTimes = (personalBest.splits ?? []).map((split) => split.time)
	if (cumulativeTimes.length === 0) return null

	const durations: number[] = []
	let previous = 0
	for (const time of cumulativeTimes) {
		if (!isFiniteNumber(time) || time <= previous || time > personalBest.time) return null
		durations.push(time - previous)
		previous = time
	}
	if (previous < personalBest.time) durations.push(personalBest.time - previous)
	return durations
}

const corroboratedTheoreticalBest = (
	personalBests: readonly LevelScorePersonalBest[],
): number | null => {
	const candidates = personalBests.map(splitDurations).filter((value) => value !== null)
	const segmentCounts = new Map<number, number>()
	for (const candidate of candidates) {
		segmentCounts.set(candidate.length, (segmentCounts.get(candidate.length) ?? 0) + 1)
	}
	const segmentCount = [...segmentCounts.entries()]
		.filter(([, count]) => count >= 5)
		.toSorted((left, right) => right[1] - left[1] || right[0] - left[0])[0]?.[0]
	if (!segmentCount) return null

	const comparable = candidates.filter((candidate) => candidate.length === segmentCount)
	let total = 0
	for (let index = 0; index < segmentCount; index += 1) {
		const segment = percentile(
			comparable.map((candidate) => candidate[index] ?? Number.NaN),
			0.05,
		)
		if (segment === null) return null
		total += segment
	}
	return total
}

const isAnomalousWorldRecord = (personalBests: readonly LevelScorePersonalBest[]): boolean => {
	const worldRecord = personalBests[0]
	if (!worldRecord) return false
	const nextFive = personalBests.slice(1, 6).map((personalBest) => personalBest.time)
	const nextFiveMean = mean(nextFive)
	const leaderboardExcluded =
		nextFive.length === 5 && worldRecord.time <= (nextFiveMean ?? 0) * 0.5
	const theoreticalBest = corroboratedTheoreticalBest(personalBests.slice(1))
	const telemetryExcluded =
		theoreticalBest !== null &&
		smoothstepBetween(theoreticalBest / worldRecord.time - 1, 0.03, 0.15) >= 1
	return leaderboardExcluded || telemetryExcluded
}

const prepareLevelScoreInput = (input: LevelScoreInput): PreparedLevelScoreInput => {
	const personalBests = input.personalBests.filter(
		(personalBest) => isFiniteNumber(personalBest.time) && personalBest.time > 0,
	)
	const personalBestCount = isFiniteNumber(input.personalBestCount)
		? Math.max(0, Math.trunc(input.personalBestCount))
		: personalBests.length
	const normalized: NormalizedLevelScoreInput = {
		personalBestCount: Math.max(personalBestCount, personalBests.length),
		voteRating: isFiniteNumber(input.voteRating) ? clamp(input.voteRating) : null,
		matureVoteCount: isFiniteNumber(input.matureVoteCount)
			? Math.max(0, Math.trunc(input.matureVoteCount))
			: null,
	}
	const allPersonalBests = personalBests
		.toSorted((left, right) => left.time - right.time)
		.slice(0, LEVEL_SCORE_PERSONAL_BEST_LIMIT)
	let effectivePersonalBests = allPersonalBests
	while (effectivePersonalBests.length > 0 && isAnomalousWorldRecord(effectivePersonalBests)) {
		effectivePersonalBests = effectivePersonalBests.slice(1)
	}
	return { allPersonalBests, normalized, personalBests: [...effectivePersonalBests] }
}

const calculateVoteFactor = (normalized: NormalizedLevelScoreInput): number => {
	const { matureVoteCount, voteRating } = normalized
	if (matureVoteCount === 0 || voteRating === null) return 1
	return clamp(
		voteRating <= 0.5 ? 0.95 + voteRating * 0.1 : 1 + (voteRating - 0.5) * 0.5,
		0.95,
		1.25,
	)
}

export const ceilLevelPointsV2 = (value: number): number =>
	Math.ceil(clamp(value, LEVEL_SCORE_V2_POINTS.minimum, LEVEL_SCORE_V2_POINTS.maximum) / 2) * 2

const complexityRun = (personalBest: LevelScorePersonalBest): ComplexityRun | null => {
	const telemetry = personalBest.telemetry
	if (telemetry?.hasInputData !== true) return null
	const duration =
		isFiniteNumber(telemetry.time) && telemetry.time > 0 ? telemetry.time : personalBest.time
	if (!isFiniteNumber(duration) || duration <= 0) return null

	const inputTimes = [
		telemetry.turnLeftTime,
		telemetry.turnRightTime,
		telemetry.brakeTime,
		telemetry.armsUpTime,
	]
	if (!inputTimes.every(isFiniteNumber)) return null

	const transitionParts = [
		telemetry.turnLeftCount,
		telemetry.turnRightCount,
		telemetry.brakeCount,
		telemetry.armsUpCount,
	]
	const transitionCount = isFiniteNumber(telemetry.driverInputTransitionCount)
		? telemetry.driverInputTransitionCount
		: transitionParts.every(isFiniteNumber)
			? transitionParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
			: null
	if (transitionCount === null) return null

	const steeringShare = clamp(
		((telemetry.turnLeftTime ?? 0) + (telemetry.turnRightTime ?? 0)) / duration,
	)
	const brakeShare = clamp((telemetry.brakeTime ?? 0) / duration)
	const armsUpShare = clamp((telemetry.armsUpTime ?? 0) / duration)
	const primaryControlShare = Math.max(steeringShare, brakeShare, armsUpShare)
	const transitionRate = Math.max(0, transitionCount) / duration
	const occupancy = smoothstepBetween(
		primaryControlShare,
		LEVEL_SCORE_V2_COMPLEXITY.primaryControlShare.minimum,
		LEVEL_SCORE_V2_COMPLEXITY.primaryControlShare.maximum,
	)
	const transitions = smoothstepBetween(
		transitionRate,
		LEVEL_SCORE_V2_COMPLEXITY.transitionRate.minimum,
		LEVEL_SCORE_V2_COMPLEXITY.transitionRate.maximum,
	)

	return {
		primaryControlShare,
		transitionRate,
		runComplexity: Math.sqrt(occupancy * transitions),
	}
}

const calculateComplexity = (personalBests: readonly LevelScorePersonalBest[]) => {
	const sample = personalBests.slice(0, LEVEL_SCORE_V2_COMPLEXITY.sampleLimit)
	const runs = sample.flatMap((personalBest) => {
		const run = complexityRun(personalBest)
		return run ? [run] : []
	})
	const runComplexities = runs.map((run) => run.runComplexity)
	const observed =
		runs.length > 0
			? 0.6 * (median(runComplexities) ?? 0) + 0.4 * (percentile(runComplexities, 0.25) ?? 0)
			: 0.5
	const targetRuns = sample.length
	const coverage = targetRuns > 0 ? runs.length / targetRuns : 0
	const quantity = smoothstepBetween(
		runs.length,
		LEVEL_SCORE_V2_COMPLEXITY.minimumComparableRuns,
		LEVEL_SCORE_V2_COMPLEXITY.fullComparableRuns,
	)
	const confidence = clamp(coverage ** 2 * quantity)

	return {
		confidence,
		runs,
		score: 0.5 + confidence * (observed - 0.5),
	}
}

const calculateSkill = (input: LevelScoreInput) => {
	const skill = input.skill
	const ratedPlayerCount = isFiniteNumber(skill?.ratedPlayerCount)
		? Math.max(0, Math.trunc(skill.ratedPlayerCount))
		: 0
	const alignment = isFiniteNumber(skill?.alignment) ? Math.max(0, skill.alignment) : null
	const separation = isFiniteNumber(skill?.separation) ? Math.max(0, skill.separation) : null
	const fieldStrength = isFiniteNumber(skill?.fieldStrength) ? clamp(skill.fieldStrength) : null
	const complete = alignment !== null && separation !== null && fieldStrength !== null
	const alignmentScore = complete
		? smoothstepBetween(
				alignment,
				LEVEL_SCORE_V2_SKILL.alignment.minimum,
				LEVEL_SCORE_V2_SKILL.alignment.maximum,
			)
		: 0.5
	const separationScore = complete
		? smoothstepBetween(
				separation,
				LEVEL_SCORE_V2_SKILL.separation.minimum,
				LEVEL_SCORE_V2_SKILL.separation.maximum,
			)
		: 0.5
	const fieldStrengthScore = complete
		? smoothstepBetween(
				fieldStrength,
				LEVEL_SCORE_V2_SKILL.fieldStrength.minimum,
				LEVEL_SCORE_V2_SKILL.fieldStrength.maximum,
			)
		: 0.5
	const selectivity = Math.sqrt(alignmentScore * separationScore)
	const observed = complete ? 0.8 * selectivity + 0.2 * fieldStrengthScore : 0.5
	const confidence = complete
		? smoothstepBetween(
				ratedPlayerCount,
				LEVEL_SCORE_V2_SKILL.minimumRatedPlayers,
				LEVEL_SCORE_V2_SKILL.fullRatedPlayers,
			)
		: 0

	return {
		alignment,
		confidence,
		fieldStrength,
		ratedPlayerCount,
		score: 0.5 + confidence * (observed - 0.5),
		separation,
	}
}

export function calculateLevelPointsV2(input: LevelScoreInput): LevelScoreResult {
	const prepared = prepareLevelScoreInput(input)
	const voteFactor = calculateVoteFactor(prepared.normalized)
	const leader = prepared.personalBests[0]

	if (!leader) {
		return {
			points: 0,
			factors: {
				evidenceFactor: LEVEL_SCORE_V2_EVIDENCE.minimumFactor,
				lengthFactor: 1,
				qualityFactor: 0.55,
				voteFactor,
			},
			metrics: {
				complexityConfidence: null,
				complexityScore: null,
				fieldStrength: null,
				qualityScore: null,
				skillAlignment: null,
				skillConfidence: null,
				skillSampleSize: null,
				skillScore: null,
				skillSeparation: null,
			},
			modifiers: {
				evidenceModifier: LEVEL_SCORE_V2_EVIDENCE.minimumFactor,
				lengthModifier: 1,
				qualityModifier: 0.55,
				ratingModifier: voteFactor,
			},
		}
	}

	const complexity = calculateComplexity(prepared.personalBests)
	const skill = calculateSkill(input)
	const qualityScore =
		LEVEL_SCORE_V2_QUALITY.complexityWeight * complexity.score +
		LEVEL_SCORE_V2_QUALITY.skillWeight * skill.score
	const qualityFactor =
		LEVEL_SCORE_V2_QUALITY.minimumFactor +
		(1 - LEVEL_SCORE_V2_QUALITY.minimumFactor) * qualityScore
	const excludedPersonalBestCount =
		prepared.allPersonalBests.length - prepared.personalBests.length
	const crediblePersonalBestCount = Math.max(
		0,
		prepared.normalized.personalBestCount - excludedPersonalBestCount,
	)
	const evidenceFactor =
		LEVEL_SCORE_V2_EVIDENCE.minimumFactor +
		(1 - LEVEL_SCORE_V2_EVIDENCE.minimumFactor) *
			smoothstepBetween(
				crediblePersonalBestCount,
				LEVEL_SCORE_V2_EVIDENCE.minimumPersonalBests,
				LEVEL_SCORE_V2_EVIDENCE.fullPersonalBests,
			)
	const lengthFactor = calculateLevelPointsV2LengthFactor(
		median(prepared.personalBests.slice(0, 10).map((personalBest) => personalBest.time)),
	)
	const factors = {
		evidenceFactor,
		lengthFactor,
		qualityFactor,
		voteFactor,
	}
	const rawPoints =
		MAX_LEVEL_POINTS *
		factors.lengthFactor *
		factors.evidenceFactor *
		factors.qualityFactor *
		factors.voteFactor

	return {
		points: ceilLevelPointsV2(rawPoints),
		factors,
		metrics: {
			complexityConfidence: complexity.confidence,
			complexityScore: complexity.score,
			fieldStrength: skill.fieldStrength,
			qualityScore,
			skillAlignment: skill.alignment,
			skillConfidence: skill.confidence,
			skillSampleSize: skill.ratedPlayerCount,
			skillScore: skill.score,
			skillSeparation: skill.separation,
		},
		modifiers: {
			evidenceModifier: factors.evidenceFactor,
			lengthModifier: factors.lengthFactor,
			qualityModifier: factors.qualityFactor,
			ratingModifier: factors.voteFactor,
		},
	}
}
