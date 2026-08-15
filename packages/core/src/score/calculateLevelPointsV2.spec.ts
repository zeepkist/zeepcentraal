import { describe, expect, test } from 'bun:test'
import {
	calculateLevelPointsV2,
	calculateLevelPointsV2LengthFactor,
	ceilLevelPointsV2,
	LEVEL_SCORE_V2_EVIDENCE,
	LEVEL_SCORE_V2_POINTS,
	type LevelScorePersonalBest,
	type LevelScoreTelemetry,
} from './calculateLevelPointsV2'

const telemetry = (
	time: number,
	overrides: Partial<LevelScoreTelemetry> = {},
): LevelScoreTelemetry => ({
	time,
	hasInputData: true,
	turnLeftTime: time * 0.25,
	turnRightTime: time * 0.25,
	brakeTime: 0,
	armsUpTime: 0,
	turnLeftCount: Math.round(time * 0.8),
	turnRightCount: Math.round(time * 0.8),
	brakeCount: 0,
	armsUpCount: 0,
	driverInputTransitionCount: Math.round(time * 1.6),
	...overrides,
})

const personalBests = (
	count: number,
	mapper: (index: number, time: number) => Partial<LevelScorePersonalBest> = () => ({}),
): LevelScorePersonalBest[] =>
	Array.from({ length: count }, (_, index) => {
		const time = 60 + index * 0.25
		return { time, ...mapper(index, time) }
	})

const strongSkill = {
	alignment: 0.85,
	separation: 0.07,
	fieldStrength: 0.8,
	ratedPlayerCount: 100,
}

describe('level score V2 primitives', () => {
	test('uses median-time length curve', () => {
		expect(calculateLevelPointsV2LengthFactor(4)).toBe(0.35)
		expect(calculateLevelPointsV2LengthFactor(5)).toBe(0.35)
		expect(calculateLevelPointsV2LengthFactor(20)).toBe(1)
		expect(calculateLevelPointsV2LengthFactor(180)).toBe(1)
		expect(calculateLevelPointsV2LengthFactor(600)).toBe(0.75)
	})

	test('ceil-rounds to next even score', () => {
		expect(ceilLevelPointsV2(9_880)).toBe(9_880)
		expect(ceilLevelPointsV2(9_880.1)).toBe(9_882)
		expect(ceilLevelPointsV2(9_881)).toBe(9_882)
		expect(ceilLevelPointsV2(0.01)).toBe(LEVEL_SCORE_V2_POINTS.minimum)
		expect(ceilLevelPointsV2(20_000)).toBe(LEVEL_SCORE_V2_POINTS.maximum)
	})
})

describe('calculateLevelPointsV2', () => {
	test('returns zero only without valid PBs', () => {
		expect(calculateLevelPointsV2({ personalBests: [] }).points).toBe(0)
		expect(calculateLevelPointsV2({ personalBests: [{ time: Number.NaN }] }).points).toBe(0)
		expect(calculateLevelPointsV2({ personalBests: [{ time: 60 }] }).points).toBeGreaterThan(0)
	})

	test('always returns bounded even nonzero points', () => {
		for (const count of [1, 5, 20, 50]) {
			const result = calculateLevelPointsV2({
				personalBests: personalBests(count, (_index, time) => ({
					telemetry: telemetry(time),
				})),
				personalBestCount: count,
				skill: strongSkill,
				matureVoteCount: 10,
				voteRating: 1,
			})
			expect(result.points).toBeGreaterThanOrEqual(2)
			expect(result.points).toBeLessThanOrEqual(9_984)
			expect(result.points % 2).toBe(0)
		}
	})

	test('uses sparse-board evidence protection and reaches full evidence at 20 PBs', () => {
		const five = calculateLevelPointsV2({ personalBests: personalBests(5) })
		const twenty = calculateLevelPointsV2({ personalBests: personalBests(20) })
		const truncatedTwenty = calculateLevelPointsV2({
			personalBests: personalBests(10),
			personalBestCount: 20,
		})

		expect(five.factors.evidenceFactor).toBe(LEVEL_SCORE_V2_EVIDENCE.minimumFactor)
		expect(twenty.factors.evidenceFactor).toBe(1)
		expect(truncatedTwenty.factors.evidenceFactor).toBe(1)
		expect(twenty.points).toBeGreaterThan(five.points)
	})

	test('asymmetrically rewards positive mature votes in final score', () => {
		const base = { personalBests: personalBests(20), matureVoteCount: 10 }
		const neutral = calculateLevelPointsV2({ ...base, voteRating: 0.5 })
		const positive = calculateLevelPointsV2({ ...base, voteRating: 0.75 })

		expect(calculateLevelPointsV2({ ...base, voteRating: 0 }).factors.voteFactor).toBe(0.95)
		expect(neutral.factors.voteFactor).toBe(1)
		expect(positive.factors.voteFactor).toBe(1.125)
		expect(calculateLevelPointsV2({ ...base, voteRating: 1 }).factors.voteFactor).toBe(1.25)
		expect(positive.points).toBeGreaterThan(neutral.points)
		expect(calculateLevelPointsV2(base).factors.voteFactor).toBe(1)
		expect(
			calculateLevelPointsV2({ ...base, voteRating: 1, matureVoteCount: 0 }).factors
				.voteFactor,
		).toBe(1)
	})

	test('shrinks missing complexity and skill evidence to neutral', () => {
		const result = calculateLevelPointsV2({ personalBests: personalBests(20) })

		expect(result.metrics.complexityConfidence).toBe(0)
		expect(result.metrics.complexityScore).toBe(0.5)
		expect(result.metrics.skillConfidence).toBe(0)
		expect(result.metrics.skillScore).toBe(0.5)
		expect(result.metrics.qualityScore).toBe(0.5)
	})

	test('rewards sustained control occupancy and transition density', () => {
		const low = calculateLevelPointsV2({
			personalBests: personalBests(20, (_index, time) => ({
				telemetry: telemetry(time, {
					turnLeftTime: time * 0.01,
					turnRightTime: time * 0.01,
					driverInputTransitionCount: Math.round(time * 0.2),
				}),
			})),
			skill: strongSkill,
		})
		const high = calculateLevelPointsV2({
			personalBests: personalBests(20, (_index, time) => ({ telemetry: telemetry(time) })),
			skill: strongSkill,
		})

		expect(high.metrics.complexityConfidence).toBe(1)
		expect(high.metrics.complexityScore).toBeGreaterThan(low.metrics.complexityScore ?? 0)
		expect(high.points).toBeGreaterThan(low.points)
	})

	test('increases complexity when either control axis strengthens', () => {
		const score = (controlShare: number, transitionRate: number) =>
			calculateLevelPointsV2({
				personalBests: personalBests(20, (_index, time) => ({
					telemetry: telemetry(time, {
						turnLeftTime: time * controlShare * 0.5,
						turnRightTime: time * controlShare * 0.5,
						driverInputTransitionCount: time * transitionRate,
					}),
				})),
			}).metrics.complexityScore ?? 0

		const baseline = score(0.3, 1.2)
		expect(score(0.55, 1.2)).toBeGreaterThan(baseline)
		expect(score(0.3, 1.8)).toBeGreaterThan(baseline)
	})

	test('uses braking or arms-up as primary control demand', () => {
		const result = calculateLevelPointsV2({
			personalBests: personalBests(20, (_index, time) => ({
				telemetry: telemetry(time, {
					turnLeftTime: 0,
					turnRightTime: 0,
					brakeTime: time * 0.5,
				}),
			})),
		})

		expect(result.metrics.complexityScore).toBeGreaterThan(0.5)
	})

	test('falls back to summed input transition counts', () => {
		const result = calculateLevelPointsV2({
			personalBests: personalBests(20, (_index, time) => ({
				telemetry: telemetry(time, { driverInputTransitionCount: null }),
			})),
		})

		expect(result.metrics.complexityConfidence).toBe(1)
		expect(result.metrics.complexityScore).toBeGreaterThan(0.5)
	})

	test('rewards alignment, separation, and field strength', () => {
		const weak = calculateLevelPointsV2({
			personalBests: personalBests(20),
			skill: {
				alignment: 0.45,
				separation: 0.005,
				fieldStrength: 0.6,
				ratedPlayerCount: 100,
			},
		})
		const strong = calculateLevelPointsV2({
			personalBests: personalBests(20),
			skill: strongSkill,
		})

		expect(strong.metrics.skillConfidence).toBe(1)
		expect(strong.metrics.skillScore).toBeGreaterThan(weak.metrics.skillScore ?? 0)
		expect(strong.points).toBeGreaterThan(weak.points)
	})

	test('increases skill score for each independent skill signal', () => {
		const baselineSkill = {
			alignment: 0.65,
			separation: 0.0375,
			fieldStrength: 0.7,
			ratedPlayerCount: 100,
		}
		const score = (skill: typeof baselineSkill) =>
			calculateLevelPointsV2({ personalBests: personalBests(20), skill }).metrics
				.skillScore ?? 0
		const baseline = score(baselineSkill)

		expect(score({ ...baselineSkill, alignment: 0.85 })).toBeGreaterThan(baseline)
		expect(score({ ...baselineSkill, separation: 0.07 })).toBeGreaterThan(baseline)
		expect(score({ ...baselineSkill, fieldStrength: 0.8 })).toBeGreaterThan(baseline)
	})

	test('ranks a wider technical skill-selective board above compressed low-control board', () => {
		const compressed = calculateLevelPointsV2({
			personalBests: personalBests(20, (index, time) => ({
				time: 60 + index * 0.01,
				telemetry: telemetry(time, {
					turnLeftTime: time * 0.01,
					turnRightTime: time * 0.01,
					driverInputTransitionCount: Math.round(time * 0.2),
				}),
			})),
			skill: {
				alignment: 0.45,
				separation: 0.005,
				fieldStrength: 0.6,
				ratedPlayerCount: 100,
			},
		})
		const technical = calculateLevelPointsV2({
			personalBests: personalBests(20, (index, time) => ({
				time: 60 + index * 0.5,
				telemetry: telemetry(time),
			})),
			skill: strongSkill,
		})

		expect(technical.points).toBeGreaterThan(compressed.points)
	})

	test('does not mutate input and remains deterministic for input order', () => {
		const input = personalBests(20, (_index, time) => ({ telemetry: telemetry(time) }))
		const original = structuredClone(input)
		const forward = calculateLevelPointsV2({ personalBests: input, skill: strongSkill })
		const reversed = calculateLevelPointsV2({
			personalBests: input.toReversed(),
			skill: strongSkill,
		})

		expect(input).toEqual(original)
		expect(reversed.points).toBe(forward.points)
		expect(reversed.factors).toEqual(forward.factors)
	})

	test('excludes anomalous leaders from scoring inputs', () => {
		const result = calculateLevelPointsV2({
			personalBests: [
				{ time: 10 },
				...personalBests(20, (index) => ({ time: 30 + index * 0.05 })),
			],
		})

		expect(result.modifiers).not.toHaveProperty('cutPenalty')
		expect(result.points).toBeGreaterThan(0)
	})

	test('synchronizes actual and diagnostic modifiers', () => {
		const result = calculateLevelPointsV2({ personalBests: personalBests(20) })

		expect(result.modifiers.lengthModifier).toBe(result.factors.lengthFactor)
		expect(result.modifiers.evidenceModifier).toBe(result.factors.evidenceFactor)
		expect(result.modifiers.qualityModifier).toBe(result.factors.qualityFactor)
		expect(result.modifiers.ratingModifier).toBe(result.factors.voteFactor)
	})
})
