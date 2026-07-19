import { describe, expect, test } from 'bun:test'
import type {
	calculateLevelPoints,
	LevelScorePersonalBest,
	LevelScoreTelemetry,
} from './calculateLevelPoints'
import {
	calculateLevelPointsV2,
	calculateLevelPointsV2LengthFactor,
	calculateLevelPointsV2Tightness,
	ceilLevelPointsV2,
	LEVEL_SCORE_V2_EVIDENCE,
	LEVEL_SCORE_V2_POINTS,
} from './calculateLevelPointsV2'

const personalBests = (
	count: number,
	mapper: (index: number) => Partial<LevelScorePersonalBest> = () => ({}),
): LevelScorePersonalBest[] =>
	Array.from({ length: count }, (_, index) => ({
		time: 60 + index * 0.25,
		...mapper(index),
	}))

const steeringTelemetry = (overrides: Partial<LevelScoreTelemetry> = {}): LevelScoreTelemetry => ({
	time: 60,
	hasInputData: true,
	hasRagdollData: true,
	hasSlipData: true,
	hasVelocityData: true,
	turnLeftTime: 9,
	turnRightTime: 9,
	turnLeftCount: 12,
	turnRightCount: 12,
	distance: 1_000,
	averageSpeed: 100,
	brakeTime: 0,
	brakeCount: 0,
	armsUpTime: 0,
	armsUpCount: 0,
	timeAnyDriverInput: 18,
	driverInputTransitionCount: 24,
	...overrides,
})

const splitRun = (
	time: number,
	speeds: readonly number[] = [100, 100],
): LevelScorePersonalBest => ({
	time,
	splits: [
		{ time: time / 3, speed: speeds[0] },
		{ time: (time * 2) / 3, speed: speeds[1] },
	],
})

describe('level score V2 primitives', () => {
	test('uses logarithmic percentage-gap tightness', () => {
		expect(calculateLevelPointsV2Tightness(60, 60.3, 0.005)).toBeCloseTo(0.5, 10)
		expect(calculateLevelPointsV2Tightness(60, 60, 0.005)).toBe(1)
		expect(calculateLevelPointsV2Tightness(0, 60, 0.005)).toBe(0)
	})

	test('uses exact length anchors and smooth transitions', () => {
		expect(calculateLevelPointsV2LengthFactor(3)).toBe(0.01)
		expect(calculateLevelPointsV2LengthFactor(6)).toBe(0.08)
		expect(calculateLevelPointsV2LengthFactor(8)).toBeCloseTo(0.54)
		expect(calculateLevelPointsV2LengthFactor(10)).toBe(1)
		expect(calculateLevelPointsV2LengthFactor(90)).toBe(1)
		expect(calculateLevelPointsV2LengthFactor(180)).toBe(0.95)
		expect(calculateLevelPointsV2LengthFactor(300)).toBe(0.9)
		expect(calculateLevelPointsV2LengthFactor(600)).toBe(0.8)
	})

	test('ceil-rounds to the next even score', () => {
		expect(ceilLevelPointsV2(9_880)).toBe(9_880)
		expect(ceilLevelPointsV2(9_880.1)).toBe(9_882)
		expect(ceilLevelPointsV2(9_881)).toBe(9_882)
		expect(ceilLevelPointsV2(0.01)).toBe(LEVEL_SCORE_V2_POINTS.minimum)
		expect(ceilLevelPointsV2(20_000)).toBe(LEVEL_SCORE_V2_POINTS.maximum)
	})
})

describe('calculateLevelPointsV2', () => {
	test('is a drop-in replacement for V1', () => {
		const compatible: typeof calculateLevelPoints = calculateLevelPointsV2
		const result = compatible({
			topTimes: [60, 61, 62],
			personalBests: 3,
			personalBestCountPercentile: 100,
			rating: 0.5,
		})

		expect(result.points).toBeGreaterThan(0)
		expect(result.modifiers.lengthModifier).toBe(result.factors.lengthFactor)
	})

	test('returns zero only when no valid personal best exists', () => {
		const empty = calculateLevelPointsV2({ personalBests: [] })
		const invalid = calculateLevelPointsV2({ personalBests: [{ time: Number.NaN }] })
		const scored = calculateLevelPointsV2({ personalBests: [{ time: 60 }] })

		expect(empty.points).toBe(0)
		expect(invalid.points).toBe(0)
		expect(scored.points).toBeGreaterThanOrEqual(LEVEL_SCORE_V2_POINTS.minimum)
	})

	test('always returns bounded even points', () => {
		for (const count of [1, 2, 5, 10, 50]) {
			const result = calculateLevelPointsV2({
				personalBests: personalBests(count),
				personalBestCount: count,
				matureVoteCount: 10,
				voteRating: 1,
			})
			expect(result.points).toBeGreaterThanOrEqual(2)
			expect(result.points).toBeLessThanOrEqual(9_984)
			expect(result.points % 2).toBe(0)
		}
	})

	test('reaches full evidence at ten credible PBs', () => {
		const one = calculateLevelPointsV2({ personalBests: personalBests(1) })
		const ten = calculateLevelPointsV2({ personalBests: personalBests(10) })
		const fifty = calculateLevelPointsV2({ personalBests: personalBests(50) })

		expect(one.metrics.leaderboardConfidence).toBe(0)
		expect(one.factors.participationFactor).toBe(LEVEL_SCORE_V2_EVIDENCE.minimumFactor)
		expect(ten.metrics.leaderboardConfidence).toBe(1)
		expect(ten.factors.participationFactor).toBe(1)
		expect(fifty.metrics.leaderboardConfidence).toBe(1)
		expect(fifty.factors.participationFactor).toBe(1)
	})

	test('bounds popularity to five percent after evidence is full', () => {
		const low = calculateLevelPointsV2({
			personalBests: personalBests(10),
			personalBestCount: 10,
			eligibleLevelP90PersonalBestCount: 1_000,
		})
		const high = calculateLevelPointsV2({
			personalBests: personalBests(10),
			personalBestCount: 1_000,
			eligibleLevelP90PersonalBestCount: 1_000,
		})

		expect(low.factors.participationFactor).toBeGreaterThanOrEqual(0.95)
		expect(high.factors.participationFactor).toBe(1)
		expect(
			high.factors.participationFactor - low.factors.participationFactor,
		).toBeLessThanOrEqual(0.05)
	})

	test('limits mature votes to three percent', () => {
		const base = { personalBests: personalBests(10), matureVoteCount: 10 }
		expect(calculateLevelPointsV2({ ...base, voteRating: 0 }).factors.voteFactor).toBe(0.97)
		expect(calculateLevelPointsV2({ ...base, voteRating: 0.5 }).factors.voteFactor).toBe(1)
		expect(calculateLevelPointsV2({ ...base, voteRating: 1 }).factors.voteFactor).toBe(1.03)
		expect(
			calculateLevelPointsV2({ ...base, voteRating: 1, matureVoteCount: 0 }).factors
				.voteFactor,
		).toBe(1)
	})

	test('uses the fixed missing-telemetry score', () => {
		const result = calculateLevelPointsV2({ personalBests: personalBests(10) })

		expect(result.factors.passivePlayFactor).toBe(0.9)
		expect(result.metrics.driverEngagementScore).toBeNull()
		expect(result.metrics.afkModifier).toBe(0.9)
	})

	test('does not treat older capability rows as extended telemetry', () => {
		const result = calculateLevelPointsV2({
			personalBests: personalBests(10, () => ({
				telemetry: steeringTelemetry({
					hasRagdollData: false,
					hasSlipData: false,
				}),
			})),
		})

		expect(result.factors.passivePlayFactor).toBe(0.9)
		expect(result.metrics.driverEngagementScore).toBeNull()
	})

	test('rewards steering evidence over competitive low-steering runs', () => {
		const active = calculateLevelPointsV2({
			personalBests: personalBests(10, (index) => ({
				telemetry: steeringTelemetry({ time: 60 + index * 0.25 }),
			})),
		})
		const lowSteering = calculateLevelPointsV2({
			personalBests: personalBests(10, (index) => ({
				telemetry: steeringTelemetry({
					time: 60 + index * 0.25,
					turnLeftTime: 0,
					turnRightTime: 0,
					turnLeftCount: 0,
					turnRightCount: 0,
				}),
			})),
		})

		expect(active.factors.passivePlayFactor).toBeGreaterThan(
			lowSteering.factors.passivePlayFactor,
		)
		expect(lowSteering.metrics.passivePlaySeverity).toBeGreaterThan(0)
	})

	test('never uses arms-up or braking directly or through union input fields', () => {
		const baselineTelemetry = steeringTelemetry()
		const alteredTelemetry = steeringTelemetry({
			armsUpCount: 100_000,
			armsUpTime: 60,
			brakeCount: 100_000,
			brakeTime: 60,
			timeAnyDriverInput: 60,
			driverInputTransitionCount: 200_000,
		})
		const baseline = calculateLevelPointsV2({
			personalBests: personalBests(10, () => ({ telemetry: baselineTelemetry })),
		})
		const altered = calculateLevelPointsV2({
			personalBests: personalBests(10, () => ({ telemetry: alteredTelemetry })),
		})

		expect(altered.points).toBe(baseline.points)
		expect(altered.factors).toEqual(baseline.factors)
		expect(altered.metrics.medianArmsUpShare).not.toBe(baseline.metrics.medianArmsUpShare)
		expect(altered.metrics.medianBrakeShare).not.toBe(baseline.metrics.medianBrakeShare)
	})

	test('does not mutate input and is deterministic for tied leaders', () => {
		const input = [
			{ ...splitRun(60, [120, 110]), telemetry: steeringTelemetry() },
			{ ...splitRun(60, [110, 120]), telemetry: steeringTelemetry() },
			...Array.from({ length: 10 }, (_, index) => ({
				...splitRun(60, [90 + index, 100 + index]),
				telemetry: steeringTelemetry({
					turnLeftTime: index,
					turnRightTime: 10 - index,
				}),
			})),
		]
		const original = structuredClone(input)
		const forward = calculateLevelPointsV2({ personalBests: input })
		const reversed = calculateLevelPointsV2({ personalBests: input.toReversed() })

		expect(input).toEqual(original)
		expect(reversed.points).toBe(forward.points)
		expect(reversed.factors).toEqual(forward.factors)
	})

	test('excludes an anomalous WR cohort without penalizing the level directly', () => {
		const result = calculateLevelPointsV2({
			personalBests: [
				{ time: 10 },
				...personalBests(10, (index) => ({ time: 30 + index * 0.05 })),
			],
		})

		expect(result.metrics.worldRecordExcluded).toBe(true)
		expect(result.metrics.leaderboardAnomalyScore).toBe(1)
		expect(result.modifiers.cutPenalty).toBe(1)
		expect(result.points).toBeGreaterThan(0)
	})

	test('only the top ten drive quality factors', () => {
		const topTen = personalBests(10)
		const base = calculateLevelPointsV2({ personalBests: topTen })
		const extended = calculateLevelPointsV2({
			personalBests: [
				...topTen,
				...personalBests(40, (index) => ({ time: 120 + index * 10 })),
			],
		})

		expect(extended.points).toBe(base.points)
		expect(extended.factors).toEqual(base.factors)
		expect(extended.metrics.sampleSize).toBe(50)
	})

	test('ignores tail split profiles when resolving WR anomalies', () => {
		const topTen = personalBests(10)
		const base = calculateLevelPointsV2({ personalBests: topTen })
		const extended = calculateLevelPointsV2({
			personalBests: [
				...topTen,
				...Array.from({ length: 40 }, (_, index) => ({
					time: 100 + index,
					splits: [{ time: 50 }, { time: 90 }],
				})),
			],
		})

		expect(extended.metrics.worldRecordExcluded).toBe(base.metrics.worldRecordExcluded)
		expect(extended.points).toBe(base.points)
		expect(extended.factors).toEqual(base.factors)
	})

	test('record dates remain descriptive and cannot affect points', () => {
		const undated = calculateLevelPointsV2({ personalBests: personalBests(10) })
		const dated = calculateLevelPointsV2({
			personalBests: personalBests(10, (index) => ({
				dateCreated: new Date(Date.UTC(2000 + index, 0, 1)),
			})),
		})

		expect(dated.points).toBe(undated.points)
		expect(dated.factors).toEqual(undated.factors)
	})

	test('severely reduces sub-six-second levels', () => {
		const short = calculateLevelPointsV2({
			personalBests: personalBests(10, (index) => ({ time: 5 + index * 0.01 })),
		})
		const normal = calculateLevelPointsV2({ personalBests: personalBests(10) })

		expect(short.factors.lengthFactor).toBeLessThanOrEqual(0.08)
		expect(short.points).toBeLessThan(normal.points * 0.1)
	})

	test('rewards a tight elite field without rewarding one slow outlier', () => {
		const challengeTimes = [60, 60.1, 60.2, 60.3, 60.4, 70, 71, 72, 73, 74]
		const challenge = calculateLevelPointsV2({
			personalBests: challengeTimes.map((time) => splitRun(time)),
		})
		const oneOutlierTimes = [60, 60.1, 60.2, 60.3, 60.4, 60.5, 60.6, 60.7, 60.8, 120]
		const oneOutlier = calculateLevelPointsV2({
			personalBests: oneOutlierTimes.map((time) => splitRun(time)),
		})

		expect(challenge.metrics.competitivenessScore).toBeGreaterThan(
			oneOutlier.metrics.competitivenessScore ?? 0,
		)
	})

	test('reduces fixed-duration duplicate leaderboards', () => {
		const duplicates = calculateLevelPointsV2({
			personalBests: personalBests(10, () => ({ time: 60 })),
		})
		const distinct = calculateLevelPointsV2({
			personalBests: personalBests(10, (index) => ({ time: 60 + index * 0.01 })),
		})

		expect(duplicates.metrics.competitivenessScore).toBeLessThan(
			distinct.metrics.competitivenessScore ?? 0,
		)
	})

	test('checkpoint speed must convert into following-segment pace', () => {
		const strong = calculateLevelPointsV2({
			personalBests: [
				splitRun(60, [130, 130]),
				...Array.from({ length: 9 }, (_, index) => splitRun(61 + index * 0.1, [100, 100])),
			],
		})
		const weak = calculateLevelPointsV2({
			personalBests: [
				splitRun(60, [20, 20]),
				...Array.from({ length: 9 }, (_, index) => splitRun(61 + index * 0.1, [100, 100])),
			],
		})

		expect(strong.metrics.speedConsistencyScore).toBeGreaterThan(
			weak.metrics.speedConsistencyScore ?? 0,
		)
		expect(strong.metrics.worldRecordDifficultyScore).toBeGreaterThan(
			weak.metrics.worldRecordDifficultyScore ?? 0,
		)
	})

	test('keeps descriptive telemetry magnitude out of score', () => {
		const baseline = calculateLevelPointsV2({
			personalBests: personalBests(10, () => ({
				telemetry: steeringTelemetry({
					hasAirData: true,
					hasRagdollData: true,
					hasSlipData: true,
					hasSurfaceData: true,
					maxSpeed: 120,
					timeInAir: 0,
					timeRagdoll: 0,
					timeSlipping: 0,
					timeOnTarmac: 60,
				}),
			})),
		})
		const altered = calculateLevelPointsV2({
			personalBests: personalBests(10, () => ({
				telemetry: steeringTelemetry({
					hasAirData: true,
					hasRagdollData: true,
					hasSlipData: true,
					hasSurfaceData: true,
					maxSpeed: 500,
					timeInAir: 30,
					timeRagdoll: 20,
					timeSlipping: 10,
					timeOnGrass: 30,
					timeOnIce: 30,
				}),
			})),
		})

		expect(altered.points).toBe(baseline.points)
		expect(altered.factors).toEqual(baseline.factors)
		expect(altered.metrics.typicalAirTimeShare).not.toBe(baseline.metrics.typicalAirTimeShare)
	})

	test('keeps factor and legacy modifier values synchronized', () => {
		const result = calculateLevelPointsV2({ personalBests: personalBests(10) })

		expect(result.modifiers.lengthModifier).toBe(result.factors.lengthFactor)
		expect(result.modifiers.competitivenessModifier).toBeCloseTo(
			0.1 + 1.9 * result.factors.competitiveMerit,
		)
		expect(result.modifiers.ratingModifier).toBe(result.factors.voteFactor)
		expect(result.modifiers.popularityModifier).toBe(result.factors.participationFactor)
		expect(result.modifiers.cutPenalty).toBe(1)
	})
})
