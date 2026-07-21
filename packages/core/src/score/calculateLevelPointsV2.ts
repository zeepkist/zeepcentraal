import {
	calculateLeaderboardTightness,
	calculateLegacyLevelScoreObservations,
	calculateLevelLengthFactor,
	type LegacyLevelScoreInput,
	type LevelScoreInput,
	type LevelScorePersonalBest,
	type LevelScoreResult,
	MAX_LEVEL_POINTS,
	prepareLevelScoreInput,
} from './calculateLevelPoints'

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
	minimumRatedPlayers: 20,
	fullRatedPlayers: 100,
} as const

export const LEVEL_SCORE_V2_EVIDENCE = {
	minimumFactor: 0.2,
	minimumPersonalBests: 5,
	fullPersonalBests: 20,
} as const

export const LEVEL_SCORE_V2_QUALITY = {
	minimumFactor: 0.1,
	complexityWeight: 0.5,
	skillWeight: 0.5,
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

export const calculateLevelPointsV2Tightness = calculateLeaderboardTightness
export const calculateLevelPointsV2LengthFactor = calculateLevelLengthFactor

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

const calculateSkill = (input: LevelScoreInput | LegacyLevelScoreInput) => {
	const skill = 'skill' in input ? input.skill : null
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

export function calculateLevelPointsV2(
	input: LevelScoreInput | LegacyLevelScoreInput,
): LevelScoreResult {
	const prepared = prepareLevelScoreInput(input)
	const observations = calculateLegacyLevelScoreObservations(prepared)
	const competitiveMerit = observations.competitiveMerit
	const leader = prepared.personalBests[0]

	if (!leader) {
		return {
			points: 0,
			factors: {
				evidenceFactor: LEVEL_SCORE_V2_EVIDENCE.minimumFactor,
				lengthFactor: 1,
				qualityFactor: 0.55,
				voteFactor: observations.voteFactor,
			},
			metrics: {
				competitiveMerit: null,
				complexityConfidence: null,
				complexityScore: null,
				fieldStrength: null,
				qualityScore: null,
				skillAlignment: null,
				skillConfidence: null,
				skillSampleSize: null,
				skillScore: null,
				skillSeparation: null,
				worldRecordExcluded: observations.worldRecordExcluded,
			},
			modifiers: {
				competitivenessModifier: observations.competitivenessModifier,
				evidenceModifier: LEVEL_SCORE_V2_EVIDENCE.minimumFactor,
				lengthModifier: 1,
				qualityModifier: 0.55,
				ratingModifier: observations.voteFactor,
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
	const lengthFactor = calculateLevelLengthFactor(
		median(prepared.personalBests.slice(0, 10).map((personalBest) => personalBest.time)),
	)
	const factors = {
		evidenceFactor,
		lengthFactor,
		qualityFactor,
		voteFactor: observations.voteFactor,
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
			competitiveMerit,
			complexityConfidence: complexity.confidence,
			complexityScore: complexity.score,
			fieldStrength: skill.fieldStrength,
			qualityScore,
			skillAlignment: skill.alignment,
			skillConfidence: skill.confidence,
			skillSampleSize: skill.ratedPlayerCount,
			skillScore: skill.score,
			skillSeparation: skill.separation,
			worldRecordExcluded: observations.worldRecordExcluded,
		},
		modifiers: {
			evidenceModifier: factors.evidenceFactor,
			lengthModifier: factors.lengthFactor,
			competitivenessModifier: observations.competitivenessModifier,
			qualityModifier: factors.qualityFactor,
			ratingModifier: factors.voteFactor,
		},
	}
}
