/** *
 * BASE_POINTS * LENGTH_SHORT.MAX * COMPETITIVENESS.MAX * RATING.MAX * POPULARITY.MAX
 * 2560 	   * 1                * 2                   * 1.5        * 1.3
 *
 * Theoretical maximum points for a level is: 9984
 */
const BASE_POINTS = 2_560
const MINIMUM_PBS = 5
const MODIFIERS = {
	LENGTH_SHORT: {
		MIN: 0.1,
		MAX: 1.0,
		MIN_SECONDS: 5,
		MAX_SECONDS: 20,
	},
	LENGTH_LONG: {
		MIN: 0.5,
		MAX: 1.0,
		MIN_SECONDS: 75,
		MAX_SECONDS: 120,
	},
	COMPETITIVENESS: {
		MIN: 0.1,
		MAX: 2.0,
	},
	RATING: {
		MIN: 0.5,
		MAX: 1.5,
	},
	POPULARITY: {
		MIN: 0.7,
		MAX: 1.3,
	},
	CUT_PENALTY: 0.5,
}

const clamp = (value: number, min: number, max: number): number =>
	Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max)
		? Math.max(min, Math.min(max, value))
		: Number.NaN

function average(array: number[]): number {
	return array.length ? array.reduce((sum, val) => sum + val, 0) / array.length : Number.NaN
}

const normaliseNumber = (value: number) => (Number.isNaN(value) ? 0 : value)
const toEven = (value: number): number => Math.round(value / 2) * 2

const round = (value: number, precision = 7): number => {
	if (!Number.isFinite(value)) {
		return Number.NaN
	}

	const factor = 10 ** precision
	return Math.round(value * factor) / factor
}

const standardDeviation = (values: number[]): number => {
	const mean = average(values)
	const variance = average(values.map((value) => (value - mean) ** 2))
	return Math.sqrt(variance)
}

function modeFrequency<T>(arr: T[]): Map<T, number> {
	const frequency = new Map<T, number>()
	for (const value of arr) {
		frequency.set(value, (frequency.get(value) ?? 0) + 1)
	}
	return frequency
}

function uniqueValues<T>(arr: T[]): T[] {
	return Array.from(new Set(arr))
}

function shortLengthMultiplier(wrTime: number): number {
	const min = MODIFIERS.LENGTH_SHORT.MIN
	const max = MODIFIERS.LENGTH_SHORT.MAX - min
	const start = MODIFIERS.LENGTH_SHORT.MIN_SECONDS
	const end = MODIFIERS.LENGTH_SHORT.MAX_SECONDS

	if (wrTime < end) {
		const clampedTime = Math.max(0, wrTime - start)
		const progress = clampedTime / (end - start)
		const eased = Math.sqrt(progress)
		return round(min + eased * max)
	}

	return 1
}

function longLengthMultiplier(wrTime: number): number {
	const longStart = MODIFIERS.LENGTH_LONG.MIN_SECONDS
	const longEnd = MODIFIERS.LENGTH_LONG.MAX_SECONDS
	const longMin = MODIFIERS.LENGTH_LONG.MIN
	const longMax = MODIFIERS.LENGTH_LONG.MAX - longMin

	if (wrTime > longStart) {
		const clampedTime = Math.min(wrTime, longEnd)
		const progress = (clampedTime - longStart) / (longEnd - longStart)
		const eased = 1 - Math.sqrt(progress)
		return round(longMin + eased * longMax)
	}

	return 1
}

function levelScoreLengthMultiplier(wrTime: number): number {
	if (wrTime < MODIFIERS.LENGTH_SHORT.MAX_SECONDS) {
		return shortLengthMultiplier(wrTime)
	}
	if (wrTime > MODIFIERS.LENGTH_LONG.MIN_SECONDS) {
		return longLengthMultiplier(wrTime)
	}
	return 1
}

function levelScoreCompetitivenessMultiplier(
	wrTime: number,
	topTimes: number[],
): { modifier: number } {
	const min = MODIFIERS.COMPETITIVENESS.MIN
	const max = MODIFIERS.COMPETITIVENESS.MAX
	const numPlayers = topTimes.length

	if (!Number.isFinite(wrTime) || numPlayers <= MINIMUM_PBS) {
		return { modifier: min }
	}

	const avgTimes = average(topTimes)
	const safeWrTime = Math.max(wrTime, 1e-9)
	const logTimeRatios = topTimes.map((time) => Math.log(Math.max(time, 1e-9) / safeWrTime))
	const logTimeStdDev = standardDeviation(logTimeRatios)
	const tightnessScoreBase = 1 / (1 + 12 * logTimeStdDev)

	const numUniqueTimes = uniqueValues(topTimes).length
	const uniquenessRatio = numUniqueTimes / numPlayers

	const frequencyMap = modeFrequency(topTimes)
	let maxTimeFrequency = 0
	for (const freq of frequencyMap.values()) {
		maxTimeFrequency = Math.max(maxTimeFrequency, freq)
	}
	const modeFrequencyRatio = maxTimeFrequency / numPlayers

	const relativeEpsilon = 1e-6
	const nearWrCount = topTimes.filter(
		(time) => Math.abs(time - wrTime) <= Math.max(relativeEpsilon * wrTime, 1e-9),
	).length
	const nearWrRatio = nearWrCount / numPlayers

	const modeValue = Array.from(frequencyMap.entries()).reduce(
		(currentMode, [value, count]) =>
			count > (frequencyMap.get(currentMode as number) ?? 0) ? value : currentMode,
		topTimes[0],
	) as number
	const nearModeCount = topTimes.filter(
		(time) => Math.abs(time - modeValue) <= Math.max(1e-6 * modeValue, 1e-9),
	).length
	const nearModeRatio = nearModeCount / numPlayers

	const informationScore = clamp(
		uniquenessRatio ** 0.6 *
			(1 - modeFrequencyRatio) ** 0.7 *
			(1 - nearWrRatio) ** 0.8 *
			(1 - nearModeRatio) ** 0.5,
		0,
		1,
	)

	const difficultyRaw = avgTimes / wrTime - 1
	const difficultyFactor = clamp(difficultyRaw / 0.05, 0, 1)

	const rawModifier =
		1.0 +
		0.6 * (tightnessScoreBase - 0.5) * informationScore +
		0.5 * difficultyFactor * informationScore

	return { modifier: clamp(rawModifier, min, max) }
}

function levelScoreRatingModifier(rating: number): number {
	const min = MODIFIERS.RATING.MIN
	const max = MODIFIERS.RATING.MAX - min
	return round(min + clamp(rating, 0, 1) * max)
}

function levelScorePopularityModifier(personalBests: number, countPercentile: number): number {
	const min = MODIFIERS.POPULARITY.MIN
	const max = MODIFIERS.POPULARITY.MAX - min
	const cap = countPercentile * 3

	if (personalBests < MINIMUM_PBS) {
		return min
	}
	if (personalBests < cap) {
		const eased = Math.sqrt(clamp(personalBests / cap, 0, 1))
		return round(min + eased * max)
	}

	return min + max
}

function levelScoreCutPenalty(topTimes: number[], wrTime: number): number {
	const times = topTimes.slice(1, 6)
	const averageTimes = times.length ? average(times) : 0

	if (averageTimes === 0 || wrTime > averageTimes * 0.5) {
		return 1
	}

	const cutSuspicion = clamp((averageTimes * 0.5 - wrTime) / (averageTimes * 0.5), 0, 1)
	return round(1 - MODIFIERS.CUT_PENALTY * cutSuspicion)
}

export function calculateLevelPoints({
	topTimes,
	personalBests,
	rating,
	personalBestCountPercentile,
}: {
	topTimes: number[]
	personalBests: number
	rating: number
	personalBestCountPercentile: number
}) {
	if (!topTimes.length) {
		return {
			points: 0,
			modifiers: {
				lengthModifier: 0,
				competitivenessModifier: 0,
				ratingModifier: 0,
				popularityModifier: 0,
				cutPenalty: 0,
			},
		}
	}

	const wrTime = topTimes[0] ?? 0
	const lengthModifier = normaliseNumber(levelScoreLengthMultiplier(wrTime))
	const { modifier: competitivenessModifier } = levelScoreCompetitivenessMultiplier(
		wrTime,
		topTimes,
	)
	const ratingModifier = normaliseNumber(levelScoreRatingModifier(rating))
	const popularityModifier = normaliseNumber(
		levelScorePopularityModifier(personalBests, personalBestCountPercentile),
	)
	const cutPenalty = normaliseNumber(levelScoreCutPenalty(topTimes, wrTime))

	const points = toEven(
		BASE_POINTS *
			lengthModifier *
			competitivenessModifier *
			ratingModifier *
			popularityModifier *
			cutPenalty,
	)

	return {
		points,
		modifiers: {
			lengthModifier,
			competitivenessModifier,
			ratingModifier,
			popularityModifier,
			cutPenalty,
		},
	}
}
