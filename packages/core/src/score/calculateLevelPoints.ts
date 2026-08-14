export const MAX_LEVEL_POINTS = 9_984
export const LEVEL_SCORE_PERSONAL_BEST_LIMIT = 50

const COMPETITIVENESS_RANKS = [
	{ rank: 5, weight: 0.35, halfLife: 0.02 },
	{ rank: 10, weight: 0.3, halfLife: 0.04 },
	{ rank: 25, weight: 0.2, halfLife: 0.07 },
	{ rank: 50, weight: 0.15, halfLife: 0.1 },
] as const

const WORLD_RECORD_FRONTIER_RANKS = [
	{ rank: 2, weight: 0.5, halfLife: 0.01 },
	{ rank: 5, weight: 0.3, halfLife: 0.03 },
	{ rank: 10, weight: 0.2, halfLife: 0.05 },
] as const

const SURFACE_TIME_FIELDS = [
	'timeOnTarmac',
	'timeOnGrass',
	'timeOnSand',
	'timeOnSoap',
	'timeOnWood',
	'timeOnMud',
	'timeOnIce1',
	'timeOnIce2',
	'timeOnIce3',
] as const

export interface LevelScoreSplit {
	speed?: number | null
	/** Cumulative checkpoint time. Finish time is added from personal best time. */
	time: number
}

export interface LevelScoreTelemetry {
	armsUpCount?: number | null
	armsUpTime?: number | null
	averageAngularVelocity?: number | null
	averageGforce?: number | null
	averageSpeed?: number | null
	brakeCount?: number | null
	brakeTime?: number | null
	distance?: number | null
	driverInputTransitionCount?: number | null
	hasAirData?: boolean | null
	hasInputData?: boolean | null
	hasRagdollData?: boolean | null
	hasSlipData?: boolean | null
	hasStateData?: boolean | null
	hasSurfaceData?: boolean | null
	hasVelocityData?: boolean | null
	hasWheelData?: boolean | null
	maxSpeed?: number | null
	time?: number | null
	timeAnyDriverInput?: number | null
	timeInAir?: number | null
	timeOnGrass?: number | null
	timeOnGround?: number | null
	timeOnIce1?: number | null
	timeOnIce2?: number | null
	timeOnIce3?: number | null
	timeOnMud?: number | null
	timeOnSand?: number | null
	timeOnSoap?: number | null
	timeOnTarmac?: number | null
	timeOnWood?: number | null
	timeRagdoll?: number | null
	timeSlipping?: number | null
	turnLeftCount?: number | null
	turnLeftTime?: number | null
	turnRightCount?: number | null
	turnRightTime?: number | null
}

export interface LevelScorePersonalBest {
	dateCreated?: Date | string | null
	splits?: readonly LevelScoreSplit[] | null
	telemetry?: LevelScoreTelemetry | null
	time: number
}

export interface LevelScoreInput {
	/** 90th percentile PB count across all score-eligible levels. */
	eligibleLevelP90PersonalBestCount?: number | null
	matureVoteCount?: number
	/** Total current PB count, including entries outside supplied top 50. */
	personalBestCount?: number
	/** Best current personal bests. More than 50 entries are ignored. */
	personalBests: readonly LevelScorePersonalBest[]
	/** Independent cross-map player-skill observations for this level. */
	skill?: LevelScoreSkillMetrics | null
	voteRating?: number | null
}

export interface LevelScoreSkillMetrics {
	alignment: number | null
	fieldStrength: number | null
	ratedPlayerCount: number
	separation: number | null
}

/** Temporary adapter input retained while jobs migrate to rich PB records. */
export interface LegacyLevelScoreInput {
	personalBestCountPercentile: number
	personalBests: number
	rating: number
	topTimes: readonly number[]
}

export interface LevelScoreFactors {
	evidenceFactor: number
	lengthFactor: number
	qualityFactor: number
	voteFactor: number
}

export interface LegacyLevelScoreFactors {
	competitiveMerit: number
	lengthFactor: number
	participationFactor: number
	passivePlayFactor: number
	voteFactor: number
}

export interface LevelScoreTelemetrySampleCounts {
	air: number
	input: number
	ragdoll: number
	slip: number
	state: number
	surface: number
	velocity: number
	wheel: number
}

export interface LegacyLevelScoreMetrics {
	afkModifier: number | null
	airSampleSize: number
	bestPassiveGap: number | null
	bestPassiveRank: number | null
	competitiveMerit: number | null
	competitivenessScore: number | null
	complexityConfidence: number | null
	complexityScore: number | null
	driverEngagementScore: number | null
	fieldStrength: number | null
	inputCoverage: number | null
	inputSampleSize: number
	leaderboardAnomalyScore: number | null
	leaderboardConfidence: number
	lowSteeringRatio: number | null
	matureVoteCount: number | null
	medianArmsUpShare: number | null
	medianBrakeShare: number | null
	medianControlTransitionRate: number | null
	medianSteeringShare: number | null
	participationScore: number | null
	passivePlaySeverity: number | null
	passiveRunRatio: number | null
	passiveTop10Share: number | null
	pathConsistencyScore: number | null
	personalBestCount: number
	q25SteeringShare: number | null
	qualityScore: number | null
	ragdollSampleSize: number
	routeConsistencyScore: number | null
	sampleSize: number
	skillAlignment: number | null
	skillConfidence: number | null
	skillSampleSize: number | null
	skillScore: number | null
	skillSeparation: number | null
	slipSampleSize: number
	speedConsistencyScore: number | null
	stateSampleSize: number
	surfaceDiversityScore: number | null
	surfaceSampleSize: number
	telemetryAnomalyScore: number | null
	telemetrySampleCounts: LevelScoreTelemetrySampleCounts
	top5Spread: number | null
	top10Spread: number | null
	top50Spread: number | null
	typicalAirTimeShare: number | null
	typicalAverageAngularVelocity: number | null
	typicalAverageGforce: number | null
	typicalAverageSpeed: number | null
	typicalDistance: number | null
	typicalGroundTimeShare: number | null
	typicalMaxSpeed: number | null
	typicalRagdollShare: number | null
	typicalSlipShare: number | null
	velocitySampleSize: number
	wheelSampleSize: number
	worldRecordDifficultyScore: number | null
	worldRecordExcluded: boolean | null
	worldRecordMargin: number | null
	worldRecordOptimizationScore: number | null
	wrChallengerCount: number | null
	zeroControlRatio: number | null
}

export interface LevelScoreMetrics {
	competitiveMerit: number | null
	complexityConfidence: number | null
	complexityScore: number | null
	fieldStrength: number | null
	qualityScore: number | null
	skillAlignment: number | null
	skillConfidence: number | null
	skillSampleSize: number | null
	skillScore: number | null
	skillSeparation: number | null
	worldRecordExcluded: boolean | null
}

export interface LevelScoreModifiers {
	competitivenessModifier: number
	evidenceModifier: number
	lengthModifier: number
	qualityModifier: number
	ratingModifier: number
}

export interface LegacyLevelScoreModifiers extends LevelScoreModifiers {
	cutPenalty: number
	popularityModifier: number
}

export interface LevelScoreResult {
	factors: LevelScoreFactors
	metrics: LevelScoreMetrics
	modifiers: LevelScoreModifiers
	points: number
}

export interface LegacyLevelScoreResult {
	factors: LegacyLevelScoreFactors
	metrics: LegacyLevelScoreMetrics
	modifiers: LegacyLevelScoreModifiers
	points: number
}

export interface NormalizedLevelScoreInput {
	eligibleLevelP90PersonalBestCount: number | null
	matureVoteCount: number | null
	personalBestCount: number
	personalBests: LevelScorePersonalBest[]
	voteRating: number | null
}

interface InputRun {
	activity: number
	armsUpShare: number
	brakeShare: number
	buttonShare: number
	passive: boolean
	rank: number
	steeringShare: number
	time: number
	transitionCount: number
	transitionRate: number
}

const clamp = (value: number, min = 0, max = 1): number =>
	Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === 'number' && Number.isFinite(value)

const smoothstep = (value: number): number => {
	const clamped = clamp(value)
	return clamped * clamped * (3 - 2 * clamped)
}

const smoothstepBetween = (value: number, start: number, end: number): number =>
	smoothstep((value - start) / (end - start))

const median = (values: readonly number[]): number | null => percentile(values, 0.5)

const percentile = (values: readonly number[], quantile: number): number | null => {
	const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b)
	if (sorted.length === 0) {
		return null
	}
	if (sorted.length === 1) {
		return sorted[0] ?? null
	}

	const index = clamp(quantile) * (sorted.length - 1)
	const lowerIndex = Math.floor(index)
	const upperIndex = Math.ceil(index)
	const lower = sorted[lowerIndex] ?? 0
	const upper = sorted[upperIndex] ?? lower
	return lower + (upper - lower) * (index - lowerIndex)
}

const mean = (values: readonly number[]): number | null =>
	values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null

const parseDate = (value: Date | string | null | undefined): number | null => {
	if (!value) {
		return null
	}
	const timestamp = value instanceof Date ? value.getTime() : Date.parse(value)
	return Number.isFinite(timestamp) ? timestamp : null
}

const nearestEven = (value: number): number => Math.round(clamp(value, 0, MAX_LEVEL_POINTS) / 2) * 2

export const calculateLeaderboardTightness = (
	leaderTime: number,
	comparisonTime: number,
	halfLife: number,
): number => {
	if (leaderTime <= 0 || comparisonTime < leaderTime || halfLife <= 0) {
		return 0
	}
	const gap = Math.log(comparisonTime / leaderTime)
	return clamp(2 ** (-gap / Math.log1p(halfLife)))
}

export const calculateLevelLengthFactor = (medianTopTenTime: number | null): number => {
	if (!isFiniteNumber(medianTopTenTime) || medianTopTenTime <= 0) {
		return 0
	}
	if (medianTopTenTime < 5) {
		return 0.35
	}
	if (medianTopTenTime < 20) {
		return 0.35 + 0.65 * smoothstepBetween(medianTopTenTime, 5, 20)
	}
	if (medianTopTenTime <= 180) {
		return 1
	}
	if (medianTopTenTime < 600) {
		return 1 - 0.25 * smoothstepBetween(medianTopTenTime, 180, 600)
	}
	return 0.75
}

const normalizeInput = (
	input: LevelScoreInput | LegacyLevelScoreInput,
): NormalizedLevelScoreInput => {
	if ('topTimes' in input) {
		const personalBests = input.topTimes
			.filter((time) => isFiniteNumber(time) && time > 0)
			.map((time) => ({ time }))
		const personalBestCount = isFiniteNumber(input.personalBests)
			? Math.max(0, Math.trunc(input.personalBests))
			: personalBests.length
		return {
			personalBests,
			personalBestCount: Math.max(personalBestCount, personalBests.length),
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
	const personalBestCount = isFiniteNumber(input.personalBestCount)
		? Math.max(0, Math.trunc(input.personalBestCount))
		: personalBests.length
	return {
		personalBests,
		personalBestCount: Math.max(personalBestCount, personalBests.length),
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

const weightedTightness = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
	configuration: readonly { rank: number; weight: number; halfLife: number }[],
): number => {
	let score = 0
	let weight = 0
	for (const item of configuration) {
		const personalBest = personalBests[item.rank - 1]
		if (!personalBest) {
			continue
		}
		score +=
			calculateLeaderboardTightness(leaderTime, personalBest.time, item.halfLife) *
			item.weight
		weight += item.weight
	}
	return weight > 0 ? score / weight : 0.5
}

const spreadAtRank = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
	rank: number,
): number | null => {
	const personalBest = personalBests[rank - 1]
	return personalBest ? personalBest.time / leaderTime - 1 : null
}

const splitDurations = (personalBest: LevelScorePersonalBest): number[] | null => {
	const cumulativeTimes = (personalBest.splits ?? []).map((split) => split.time)
	if (cumulativeTimes.length === 0) {
		return null
	}

	const durations: number[] = []
	let previous = 0
	for (const time of cumulativeTimes) {
		if (!isFiniteNumber(time) || time <= previous || time > personalBest.time) {
			return null
		}
		const duration = time - previous
		durations.push(duration)
		previous = time
	}
	if (previous < personalBest.time) {
		durations.push(personalBest.time - previous)
	}
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
	if (!segmentCount) {
		return null
	}

	const comparable = candidates.filter((candidate) => candidate.length === segmentCount)
	let total = 0
	for (let index = 0; index < segmentCount; index += 1) {
		const segment = percentile(
			comparable.map((candidate) => candidate[index] ?? Number.NaN),
			0.05,
		)
		if (segment === null) {
			return null
		}
		total += segment
	}
	return total
}

const calculateWorldRecordAnomaly = (personalBests: readonly LevelScorePersonalBest[]) => {
	const worldRecord = personalBests[0]
	if (!worldRecord) {
		return {
			leaderboardScore: 0,
			telemetryScore: null,
			excluded: false,
		}
	}

	const nextFive = personalBests.slice(1, 6).map((personalBest) => personalBest.time)
	const nextFiveMean = mean(nextFive)
	const relativeAdvantage = nextFiveMean === null ? 0 : nextFiveMean / worldRecord.time - 1
	const leaderboardScore = smoothstepBetween(relativeAdvantage, 0.25, 1)
	const leaderboardExcluded =
		nextFive.length === 5 && worldRecord.time <= (nextFiveMean ?? 0) * 0.5

	// WR must never corroborate its own impossible split profile.
	const theoreticalBest = corroboratedTheoreticalBest(personalBests.slice(1))
	const telemetryAdvantage =
		theoreticalBest === null ? null : theoreticalBest / worldRecord.time - 1
	const telemetryScore =
		telemetryAdvantage === null ? null : smoothstepBetween(telemetryAdvantage, 0.03, 0.15)
	const telemetryExcluded = telemetryScore !== null && telemetryScore >= 1

	return {
		leaderboardScore,
		telemetryScore,
		excluded: leaderboardExcluded || telemetryExcluded,
	}
}

const resolveEffectivePersonalBests = (
	personalBests: readonly LevelScorePersonalBest[],
): {
	actualWorldRecordAnomaly: ReturnType<typeof calculateWorldRecordAnomaly>
	effectivePersonalBests: readonly LevelScorePersonalBest[]
} => {
	const actualWorldRecordAnomaly = calculateWorldRecordAnomaly(personalBests)
	let effectivePersonalBests = personalBests

	while (effectivePersonalBests.length > 0) {
		const candidateAnomaly = calculateWorldRecordAnomaly(effectivePersonalBests)
		if (!candidateAnomaly.excluded) {
			break
		}
		effectivePersonalBests = effectivePersonalBests.slice(1)
	}

	return { actualWorldRecordAnomaly, effectivePersonalBests }
}

export interface PreparedLevelScoreInput {
	allPersonalBests: LevelScorePersonalBest[]
	anomaly: ReturnType<typeof calculateWorldRecordAnomaly>
	normalized: NormalizedLevelScoreInput
	personalBests: LevelScorePersonalBest[]
}

export interface LegacyLevelScoreObservations {
	competitiveMerit: number
	competitivenessModifier: number
	competitivenessScore: number | null
	leaderboardConfidence: number
	voteFactor: number
	worldRecordChallengers: number | null
	worldRecordDifficultyScore: number | null
	worldRecordExcluded: boolean | null
	worldRecordOptimizationScore: number | null
}

export const prepareLevelScoreInput = (
	input: LevelScoreInput | LegacyLevelScoreInput,
): PreparedLevelScoreInput => {
	const normalized = normalizeInput(input)
	const allPersonalBests = normalized.personalBests
		.toSorted((left, right) => left.time - right.time)
		.slice(0, LEVEL_SCORE_PERSONAL_BEST_LIMIT)
	const { actualWorldRecordAnomaly: anomaly, effectivePersonalBests } =
		resolveEffectivePersonalBests(allPersonalBests)
	return {
		allPersonalBests,
		anomaly,
		normalized,
		personalBests: [...effectivePersonalBests],
	}
}

const calculateChallengers = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
): number | null => {
	const leaderDate = parseDate(personalBests[0]?.dateCreated)
	if (leaderDate === null) {
		return null
	}
	return personalBests.slice(1).filter((personalBest) => {
		const date = parseDate(personalBest.dateCreated)
		return date !== null && date > leaderDate && personalBest.time <= leaderTime * 1.05
	}).length
}

const calculateWorldRecordDifficulty = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderboardConfidence: number,
) => {
	const leader = personalBests[0]
	if (!leader) {
		return { score: 0, optimization: null, challengers: null }
	}

	const frontier = weightedTightness(personalBests, leader.time, WORLD_RECORD_FRONTIER_RANKS)
	const theoreticalBest = corroboratedTheoreticalBest(personalBests.slice(1))
	const optimization = theoreticalBest === null ? null : clamp(theoreticalBest / leader.time)
	const challengers = calculateChallengers(personalBests, leader.time)
	const challengerScore =
		challengers === null ? frontier : clamp(Math.log1p(challengers) / Math.log1p(10))
	const raw = 0.5 * frontier + 0.3 * (optimization ?? frontier) + 0.2 * challengerScore
	return {
		score: 0.5 + (raw - 0.5) * leaderboardConfidence,
		optimization,
		challengers,
	}
}

export const calculateLegacyLevelScoreObservations = (
	prepared: PreparedLevelScoreInput,
): LegacyLevelScoreObservations => {
	const { allPersonalBests, anomaly, normalized, personalBests } = prepared
	const leader = personalBests[0]
	if (!leader) {
		return {
			competitiveMerit: 0.5,
			competitivenessModifier: 1.05,
			competitivenessScore: null,
			leaderboardConfidence: 0,
			voteFactor: 1,
			worldRecordChallengers: null,
			worldRecordDifficultyScore: null,
			worldRecordExcluded: allPersonalBests.length > 0 ? anomaly.excluded : null,
			worldRecordOptimizationScore: null,
		}
	}

	const leaderboardConfidence = smoothstep(clamp((normalized.personalBestCount - 5) / 45))
	const rawCompetitiveness = weightedTightness(personalBests, leader.time, COMPETITIVENESS_RANKS)
	const competitivenessScore = 0.5 + (rawCompetitiveness - 0.5) * leaderboardConfidence
	const worldRecordDifficulty = calculateWorldRecordDifficulty(
		personalBests,
		leaderboardConfidence,
	)
	const competitiveMerit = 0.65 * competitivenessScore + 0.35 * worldRecordDifficulty.score
	const voteRating = normalized.voteRating === null ? null : clamp(normalized.voteRating)
	const voteFactor =
		normalized.matureVoteCount === 0 || voteRating === null
			? 1
			: clamp(
					voteRating <= 0.5 ? 0.95 + voteRating * 0.1 : 1 + (voteRating - 0.5) * 0.5,
					0.95,
					1.25,
				)

	return {
		competitiveMerit,
		competitivenessModifier: 0.1 + 1.9 * competitiveMerit,
		competitivenessScore,
		leaderboardConfidence,
		voteFactor,
		worldRecordChallengers: worldRecordDifficulty.challengers,
		worldRecordDifficultyScore: worldRecordDifficulty.score,
		worldRecordExcluded: anomaly.excluded,
		worldRecordOptimizationScore: worldRecordDifficulty.optimization,
	}
}

const capabilityCount = (
	personalBests: readonly LevelScorePersonalBest[],
	flag: keyof LevelScoreTelemetry,
): number => personalBests.filter(({ telemetry }) => telemetry?.[flag] === true).length

const getInputRuns = (personalBests: readonly LevelScorePersonalBest[]): InputRun[] => {
	const runs: InputRun[] = []
	for (const [index, personalBest] of personalBests.entries()) {
		const telemetry = personalBest.telemetry
		if (telemetry?.hasInputData !== true) {
			continue
		}
		const duration =
			isFiniteNumber(telemetry.time) && telemetry.time > 0
				? telemetry.time
				: personalBest.time
		const required = [
			telemetry.turnLeftTime,
			telemetry.turnRightTime,
			telemetry.brakeTime,
			telemetry.armsUpTime,
		]
		if (!required.every(isFiniteNumber)) {
			continue
		}
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
		if (transitionCount === null) {
			continue
		}

		const steeringShare = clamp(
			((telemetry.turnLeftTime ?? 0) + (telemetry.turnRightTime ?? 0)) / duration,
		)
		const brakeShare = clamp((telemetry.brakeTime ?? 0) / duration)
		const armsUpShare = clamp((telemetry.armsUpTime ?? 0) / duration)
		const buttonShare = Math.max(brakeShare, armsUpShare)
		const transitionRate = Math.max(0, transitionCount) / duration
		const activity = Math.max(
			smoothstepBetween(steeringShare, 0.01, 0.2),
			smoothstepBetween(buttonShare, 0.005, 0.1),
			smoothstepBetween(transitionRate, 0.05, 0.5),
		)
		runs.push({
			rank: index + 1,
			time: personalBest.time,
			steeringShare,
			brakeShare,
			armsUpShare,
			buttonShare,
			transitionCount,
			transitionRate,
			passive: steeringShare <= 0.005 && buttonShare <= 0.005 && transitionCount <= 1,
			activity,
		})
	}
	return runs
}

const calculatePassivePlay = (
	personalBests: readonly LevelScorePersonalBest[],
	leaderTime: number,
) => {
	const inputRuns = getInputRuns(personalBests)
	const inputCoverage = personalBests.length > 0 ? inputRuns.length / personalBests.length : 0
	const passiveRuns = inputRuns.filter((run) => run.passive)
	const topTenSize = Math.min(10, personalBests.length)
	const passiveTop10Share =
		inputRuns.length > 0 && topTenSize > 0
			? passiveRuns.filter((run) => run.rank <= 10).length / topTenSize
			: null
	const bestPassive = passiveRuns.toSorted((left, right) => left.time - right.time)[0]
	const bestPassiveCloseness = bestPassive
		? clamp(2 ** (-Math.log(bestPassive.time / leaderTime) / Math.log1p(0.02)))
		: 0
	const inputConfidence = inputCoverage ** 2 * smoothstep(clamp((inputRuns.length - 5) / 25))
	const rawSeverity =
		inputRuns.length > 0
			? clamp(inputConfidence * (0.6 * bestPassiveCloseness + 0.4 * (passiveTop10Share ?? 0)))
			: null
	const factor = 1 - 0.3 * (rawSeverity ?? 0)
	const severity = rawSeverity !== null && factor === 1 ? 0 : rawSeverity

	return {
		factor,
		severity,
		inputRuns,
		inputCoverage,
		passiveRunRatio: inputRuns.length > 0 ? passiveRuns.length / inputRuns.length : null,
		passiveTop10Share,
		bestPassiveRank: bestPassive?.rank ?? null,
		bestPassiveGap: bestPassive ? bestPassive.time / leaderTime - 1 : null,
	}
}

const typicalTelemetryValue = (
	personalBests: readonly LevelScorePersonalBest[],
	capability: keyof LevelScoreTelemetry | null,
	field: keyof LevelScoreTelemetry,
): number | null =>
	median(
		personalBests
			.map(({ telemetry }) =>
				telemetry && (capability === null || telemetry[capability] === true)
					? telemetry[field]
					: null,
			)
			.filter((value): value is number => isFiniteNumber(value)),
	)

const typicalTelemetryShare = (
	personalBests: readonly LevelScorePersonalBest[],
	capability: keyof LevelScoreTelemetry,
	field: keyof LevelScoreTelemetry,
): number | null => {
	const shares = personalBests.flatMap(({ time, telemetry }) => {
		if (telemetry?.[capability] !== true) {
			return []
		}
		const value = telemetry?.[field]
		const duration = telemetry?.time ?? time
		return isFiniteNumber(value) && isFiniteNumber(duration) && duration > 0
			? [clamp(value / duration)]
			: []
	})
	return median(shares)
}

const distributionConsistency = (values: readonly number[], tolerance: number): number | null => {
	const center = median(values)
	if (center === null || center <= 0 || values.length < 3) {
		return null
	}
	const deviation = median(values.map((value) => Math.abs(value - center))) ?? 0
	return 1 - clamp(deviation / center / tolerance)
}

const calculateRouteConsistency = (
	personalBests: readonly LevelScorePersonalBest[],
): number | null => {
	const routes = personalBests.flatMap((personalBest) => {
		const durations = splitDurations(personalBest)
		return durations ? [durations.map((duration) => duration / personalBest.time)] : []
	})
	const counts = new Map<number, number>()
	for (const route of routes) {
		counts.set(route.length, (counts.get(route.length) ?? 0) + 1)
	}
	const segmentCount = [...counts.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0]
	if (!segmentCount) {
		return null
	}
	const comparable = routes.filter((route) => route.length === segmentCount)
	if (comparable.length < 3) {
		return null
	}
	const deviations: number[] = []
	for (let index = 0; index < segmentCount; index += 1) {
		const segmentValues = comparable.map((route) => route[index] ?? 0)
		const center = median(segmentValues) ?? 0
		deviations.push(...segmentValues.map((value) => Math.abs(value - center)))
	}
	return 1 - clamp((mean(deviations) ?? 0) / 0.1)
}

const calculateSurfaceDiversity = (
	personalBests: readonly LevelScorePersonalBest[],
): number | null => {
	const totals = SURFACE_TIME_FIELDS.map((field) =>
		personalBests.reduce((total, { telemetry }) => {
			if (telemetry?.hasSurfaceData !== true) {
				return total
			}
			const value = telemetry?.[field]
			return total + (isFiniteNumber(value) && value > 0 ? value : 0)
		}, 0),
	)
	const total = totals.reduce((sum, value) => sum + value, 0)
	if (total <= 0) {
		return null
	}
	const entropy = totals.reduce((sum, value) => {
		if (value <= 0) {
			return sum
		}
		const share = value / total
		return sum - share * Math.log(share)
	}, 0)
	return clamp(entropy / Math.log(SURFACE_TIME_FIELDS.length))
}

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

export function calculateLevelPoints(
	input: LevelScoreInput | LegacyLevelScoreInput,
): LegacyLevelScoreResult {
	const prepared = prepareLevelScoreInput(input)
	const { allPersonalBests, anomaly, normalized, personalBests } = prepared
	const observations = calculateLegacyLevelScoreObservations(prepared)
	const leader = personalBests[0]

	if (!leader) {
		const factors = {
			lengthFactor: 1,
			competitiveMerit: observations.competitiveMerit,
			participationFactor: 0.75,
			voteFactor: observations.voteFactor,
			passivePlayFactor: 1,
		}
		return {
			points: 0,
			factors,
			metrics: {
				sampleSize: 0,
				personalBestCount: normalized.personalBestCount,
				leaderboardConfidence: 0,
				competitivenessScore: null,
				competitiveMerit: null,
				complexityConfidence: null,
				complexityScore: null,
				worldRecordDifficultyScore: null,
				participationScore:
					normalized.eligibleLevelP90PersonalBestCount === null ? null : 0,
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
				fieldStrength: null,
				worldRecordMargin: null,
				top5Spread: null,
				top10Spread: null,
				top50Spread: null,
				wrChallengerCount: null,
				worldRecordOptimizationScore: null,
				leaderboardAnomalyScore:
					allPersonalBests.length > 0 ? anomaly.leaderboardScore : null,
				telemetryAnomalyScore: allPersonalBests.length > 0 ? anomaly.telemetryScore : null,
				worldRecordExcluded: allPersonalBests.length > 0 ? anomaly.excluded : null,
				pathConsistencyScore: null,
				speedConsistencyScore: null,
				routeConsistencyScore: null,
				surfaceDiversityScore: null,
				medianSteeringShare: null,
				q25SteeringShare: null,
				qualityScore: null,
				lowSteeringRatio: null,
				zeroControlRatio: null,
				medianBrakeShare: null,
				medianArmsUpShare: null,
				medianControlTransitionRate: null,
				skillAlignment: null,
				skillConfidence: null,
				skillSampleSize: null,
				skillScore: null,
				skillSeparation: null,
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
			modifiers: {
				evidenceModifier: 1,
				lengthModifier: factors.lengthFactor,
				competitivenessModifier: observations.competitivenessModifier,
				qualityModifier: 1,
				ratingModifier: 1,
				popularityModifier: 0.75,
				cutPenalty: 1,
			},
		}
	}

	const leaderboardConfidence = observations.leaderboardConfidence
	const competitivenessScore = observations.competitivenessScore ?? 0.5
	const competitiveMerit = observations.competitiveMerit
	const lengthFactor = calculateLevelLengthFactor(
		median(personalBests.slice(0, 10).map((personalBest) => personalBest.time)),
	)

	const participationReference = normalized.eligibleLevelP90PersonalBestCount
	const participationScore =
		participationReference !== null && participationReference > 0
			? clamp(Math.log1p(normalized.personalBestCount) / Math.log1p(participationReference))
			: null
	const participationFactor = participationScore === null ? 1 : 0.75 + 0.25 * participationScore
	const voteFactor = observations.voteFactor
	const passive = calculatePassivePlay(personalBests, leader.time)

	const factors: LegacyLevelScoreFactors = {
		lengthFactor,
		competitiveMerit,
		participationFactor,
		voteFactor,
		passivePlayFactor: passive.factor,
	}
	const points = nearestEven(
		MAX_LEVEL_POINTS *
			factors.lengthFactor *
			factors.competitiveMerit *
			// factors.participationFactor *
			factors.voteFactor *
			factors.passivePlayFactor,
	)

	const telemetryCounts: LevelScoreTelemetrySampleCounts = {
		input: passive.inputRuns.length,
		air: capabilityCount(personalBests, 'hasAirData'),
		wheel: capabilityCount(personalBests, 'hasWheelData'),
		slip: capabilityCount(personalBests, 'hasSlipData'),
		state: capabilityCount(personalBests, 'hasStateData'),
		surface: capabilityCount(personalBests, 'hasSurfaceData'),
		velocity: capabilityCount(personalBests, 'hasVelocityData'),
		ragdoll: capabilityCount(personalBests, 'hasRagdollData'),
	}
	const distances = personalBests.flatMap(({ telemetry }) =>
		isFiniteNumber(telemetry?.distance) ? [telemetry.distance] : [],
	)
	const averageSpeeds = personalBests.flatMap(({ telemetry }) =>
		isFiniteNumber(telemetry?.averageSpeed) ? [telemetry.averageSpeed] : [],
	)
	const inputRuns = passive.inputRuns

	return {
		points,
		factors,
		metrics: {
			sampleSize: personalBests.length,
			personalBestCount: normalized.personalBestCount,
			leaderboardConfidence,
			competitivenessScore,
			competitiveMerit,
			complexityConfidence: null,
			complexityScore: null,
			worldRecordDifficultyScore: observations.worldRecordDifficultyScore,
			participationScore,
			matureVoteCount: normalized.matureVoteCount,
			airSampleSize: telemetryCounts.air,
			stateSampleSize: telemetryCounts.state,
			surfaceSampleSize: telemetryCounts.surface,
			velocitySampleSize: telemetryCounts.velocity,
			wheelSampleSize: telemetryCounts.wheel,
			slipSampleSize: telemetryCounts.slip,
			ragdollSampleSize: telemetryCounts.ragdoll,
			inputSampleSize: inputRuns.length,
			inputCoverage: passive.inputCoverage,
			passivePlaySeverity: passive.severity,
			afkModifier: passive.severity === null ? null : passive.factor,
			passiveRunRatio: passive.passiveRunRatio,
			passiveTop10Share: passive.passiveTop10Share,
			bestPassiveRank: passive.bestPassiveRank,
			bestPassiveGap: passive.bestPassiveGap,
			driverEngagementScore: percentile(
				inputRuns.map((run) => run.activity),
				0.25,
			),
			fieldStrength: null,
			worldRecordMargin:
				allPersonalBests[0] && allPersonalBests[1]
					? allPersonalBests[1].time / allPersonalBests[0].time - 1
					: null,
			top5Spread: spreadAtRank(personalBests, leader.time, 5),
			top10Spread: spreadAtRank(personalBests, leader.time, 10),
			top50Spread: spreadAtRank(personalBests, leader.time, 50),
			wrChallengerCount: observations.worldRecordChallengers,
			worldRecordOptimizationScore: observations.worldRecordOptimizationScore,
			leaderboardAnomalyScore: anomaly.leaderboardScore,
			telemetryAnomalyScore: anomaly.telemetryScore,
			worldRecordExcluded: anomaly.excluded,
			pathConsistencyScore: distributionConsistency(distances, 0.2),
			speedConsistencyScore: distributionConsistency(averageSpeeds, 0.1),
			routeConsistencyScore: calculateRouteConsistency(personalBests),
			surfaceDiversityScore: calculateSurfaceDiversity(personalBests),
			medianSteeringShare: median(inputRuns.map((run) => run.steeringShare)),
			q25SteeringShare: percentile(
				inputRuns.map((run) => run.steeringShare),
				0.25,
			),
			qualityScore: null,
			lowSteeringRatio:
				inputRuns.length > 0
					? inputRuns.filter((run) => run.steeringShare <= 0.01).length / inputRuns.length
					: null,
			zeroControlRatio:
				inputRuns.length > 0
					? inputRuns.filter(
							(run) =>
								run.steeringShare === 0 &&
								run.buttonShare === 0 &&
								run.transitionCount === 0,
						).length / inputRuns.length
					: null,
			medianBrakeShare: median(inputRuns.map((run) => run.brakeShare)),
			medianArmsUpShare: median(inputRuns.map((run) => run.armsUpShare)),
			medianControlTransitionRate: median(inputRuns.map((run) => run.transitionRate)),
			skillAlignment: null,
			skillConfidence: null,
			skillSampleSize: null,
			skillScore: null,
			skillSeparation: null,
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
		modifiers: {
			evidenceModifier: 1,
			lengthModifier: factors.lengthFactor,
			competitivenessModifier: observations.competitivenessModifier,
			qualityModifier: 1,
			ratingModifier: factors.voteFactor,
			popularityModifier: factors.participationFactor,
			cutPenalty: 1,
		},
	}
}
