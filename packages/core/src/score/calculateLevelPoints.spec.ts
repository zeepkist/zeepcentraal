import { describe, expect, test } from 'bun:test'
import {
	calculateLeaderboardTightness,
	calculateLevelLengthFactor,
	calculateLevelPoints,
	type LevelScorePersonalBest,
	type LevelScoreTelemetry,
	MAX_LEVEL_POINTS,
} from './calculateLevelPoints'

const activeTelemetry = (overrides: Partial<LevelScoreTelemetry> = {}): LevelScoreTelemetry => ({
	time: 60,
	hasInputData: true,
	turnLeftTime: 12,
	turnRightTime: 12,
	brakeTime: 2,
	armsUpTime: 1,
	turnLeftCount: 20,
	turnRightCount: 20,
	brakeCount: 4,
	armsUpCount: 2,
	...overrides,
})

const passiveTelemetry = (overrides: Partial<LevelScoreTelemetry> = {}): LevelScoreTelemetry => ({
	time: 60,
	hasInputData: true,
	turnLeftTime: 0,
	turnRightTime: 0,
	brakeTime: 0,
	armsUpTime: 0,
	turnLeftCount: 0,
	turnRightCount: 0,
	brakeCount: 0,
	armsUpCount: 0,
	...overrides,
})

const personalBests = (
	count: number,
	mapper: (index: number) => Partial<LevelScorePersonalBest> = () => ({}),
): LevelScorePersonalBest[] =>
	Array.from({ length: count }, (_, index) => ({
		time: 60 + index * 0.25,
		...mapper(index),
	}))

describe('level score primitives', () => {
	test('uses logarithmic half-life tightness', () => {
		expect(calculateLeaderboardTightness(60, 61.2, 0.02)).toBeCloseTo(0.5, 10)
		expect(calculateLeaderboardTightness(60, 60, 0.02)).toBe(1)
		expect(calculateLeaderboardTightness(0, 60, 0.02)).toBe(0)
	})

	test('uses median-time length plateaus and smooth transitions', () => {
		expect(calculateLevelLengthFactor(4)).toBe(0.35)
		expect(calculateLevelLengthFactor(5)).toBe(0.35)
		expect(calculateLevelLengthFactor(12.5)).toBeCloseTo(0.675)
		expect(calculateLevelLengthFactor(20)).toBe(1)
		expect(calculateLevelLengthFactor(180)).toBe(1)
		expect(calculateLevelLengthFactor(390)).toBeCloseTo(0.875)
		expect(calculateLevelLengthFactor(600)).toBe(0.75)
	})
})

describe('calculateLevelPoints', () => {
	test('returns zero when level has no personal bests', () => {
		const result = calculateLevelPoints({
			personalBests: [],
			personalBestCount: 0,
			eligibleLevelP90PersonalBestCount: 100,
			voteRating: 0.5,
			matureVoteCount: 0,
		})

		expect(result.points).toBe(0)
		expect(result.metrics.sampleSize).toBe(0)
		expect(result.metrics.participationScore).toBe(0)
		expect(result.metrics.competitivenessScore).toBeNull()
		expect(result.metrics.worldRecordDifficultyScore).toBeNull()
		expect(result.metrics.inputCoverage).toBeNull()
		expect(result.metrics.leaderboardAnomalyScore).toBeNull()
		expect(result.metrics.worldRecordExcluded).toBeNull()
		expect(result.factors.lengthFactor).toBe(1)
		expect(result.factors.competitiveMerit).toBe(0.5)
		expect(result.factors.voteFactor).toBe(1)
	})

	test('caps score at 9984 and keeps points even', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(50, () => ({ time: 60 })),
			personalBestCount: 50,
			eligibleLevelP90PersonalBestCount: 50,
			voteRating: 1,
			matureVoteCount: 20,
		})

		expect(result.points).toBe(MAX_LEVEL_POINTS)
		expect(result.points % 2).toBe(0)
		expect(result.factors.competitiveMerit).toBe(1)
	})

	test('uses exact participation logarithm and neutral missing reference', () => {
		const expected = Math.log1p(10) / Math.log1p(100)
		const scored = calculateLevelPoints({
			personalBests: personalBests(10),
			personalBestCount: 10,
			eligibleLevelP90PersonalBestCount: 100,
		})
		const neutral = calculateLevelPoints({
			personalBests: personalBests(10),
			personalBestCount: 10,
		})

		expect(scored.metrics.participationScore).toBeCloseTo(expected)
		expect(scored.factors.participationFactor).toBeCloseTo(0.75 + expected * 0.25)
		expect(neutral.metrics.participationScore).toBeNull()
		expect(neutral.factors.participationFactor).toBe(1)
	})

	test('limits vote influence and keeps zero mature votes neutral', () => {
		const base = { personalBests: personalBests(10), matureVoteCount: 10 }
		expect(calculateLevelPoints({ ...base, voteRating: 0 }).factors.voteFactor).toBe(0.95)
		expect(calculateLevelPoints({ ...base, voteRating: 1 }).factors.voteFactor).toBe(1.05)
		expect(
			calculateLevelPoints({ ...base, voteRating: 1, matureVoteCount: 0 }).factors.voteFactor,
		).toBe(1)
	})

	test('redistributes missing rank weights and shrinks sparse boards toward neutral', () => {
		const sparse = calculateLevelPoints({
			personalBests: personalBests(5),
			personalBestCount: 5,
		})
		const populated = calculateLevelPoints({
			personalBests: personalBests(50, (index) => ({ time: 60 + index * 0.01 })),
			personalBestCount: 50,
		})

		expect(sparse.metrics.leaderboardConfidence).toBe(0)
		expect(sparse.metrics.competitivenessScore).toBe(0.5)
		expect(populated.metrics.leaderboardConfidence).toBe(1)
		expect(populated.metrics.competitivenessScore).toBeGreaterThan(0.5)
	})

	test('excludes an anomalous world record instead of penalizing level', () => {
		const result = calculateLevelPoints({
			personalBests: [
				{ time: 10 },
				...personalBests(20, (index) => ({ time: 30 + index * 0.05 })),
			],
			personalBestCount: 21,
		})

		expect(result.metrics.worldRecordExcluded).toBe(true)
		expect(result.metrics.leaderboardAnomalyScore).toBe(1)
		expect(result.metrics.worldRecordMargin).toBeCloseTo(2)
		expect(result.modifiers.cutPenalty).toBe(1)
		expect(result.points).toBeGreaterThan(0)
	})

	test('iterates past multiple anomalous leaders to first credible result', () => {
		const result = calculateLevelPoints({
			personalBests: [
				{ time: 10 },
				{ time: 11 },
				...personalBests(20, (index) => ({ time: 30 + index * 0.05 })),
			],
			personalBestCount: 22,
		})

		expect(result.metrics.worldRecordExcluded).toBe(true)
		expect(result.metrics.worldRecordMargin).toBeCloseTo(0.1)
		expect(result.metrics.sampleSize).toBe(20)
		expect(result.metrics.top5Spread).toBeCloseTo(30.2 / 30 - 1)
	})

	test('excludes WR from split corroboration and flags impossible split profile', () => {
		const split = (finish: number) => [{ time: finish / 3 }, { time: (finish * 2) / 3 }]
		const result = calculateLevelPoints({
			personalBests: [
				{ time: 50, splits: split(50) },
				...personalBests(8, (index) => ({
					time: 60 + index * 0.1,
					splits: split(60 + index * 0.1),
				})),
			],
			personalBestCount: 9,
		})

		expect(result.metrics.telemetryAnomalyScore).toBe(1)
		expect(result.metrics.worldRecordExcluded).toBe(true)
	})

	test('falls back to frontier when fewer than five challenger split arrays exist', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(10, (index) => ({
				splits: index < 5 ? [{ time: 20 }, { time: 40 }] : null,
			})),
			personalBestCount: 10,
		})

		// WR is excluded from corroboration, leaving only four usable arrays.
		expect(result.metrics.telemetryAnomalyScore).toBeNull()
		expect(result.metrics.worldRecordOptimizationScore).toBeNull()
	})

	test('counts credible post-WR challengers within five percent', () => {
		const result = calculateLevelPoints({
			personalBests: [
				{ time: 60, dateCreated: '2026-01-01T00:00:00Z' },
				{ time: 61, dateCreated: '2026-02-01T00:00:00Z' },
				{ time: 62, dateCreated: '2025-12-01T00:00:00Z' },
				{ time: 64, dateCreated: '2026-03-01T00:00:00Z' },
			],
			personalBestCount: 4,
		})

		expect(result.metrics.wrChallengerCount).toBe(1)
	})

	test('applies maximum 30 percent penalty when competitive top runs are passive', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(30, (index) => ({
				time: 60 + index * 0.001,
				telemetry: passiveTelemetry({ time: 60 + index * 0.001 }),
			})),
			personalBestCount: 30,
		})

		expect(result.metrics.inputCoverage).toBe(1)
		expect(result.metrics.passivePlaySeverity).toBeCloseTo(1, 5)
		expect(result.factors.passivePlayFactor).toBeCloseTo(0.7, 5)
		expect(result.metrics.afkModifier).toBe(result.factors.passivePlayFactor)
	})

	test('does not reward active input and keeps missing telemetry neutral', () => {
		const active = calculateLevelPoints({
			personalBests: personalBests(30, () => ({ telemetry: activeTelemetry() })),
			personalBestCount: 30,
		})
		const missing = calculateLevelPoints({
			personalBests: personalBests(30),
			personalBestCount: 30,
		})

		expect(active.factors.passivePlayFactor).toBe(1)
		expect(active.metrics.driverEngagementScore).toBeGreaterThan(0)
		expect(missing.factors.passivePlayFactor).toBe(1)
		expect(missing.metrics.driverEngagementScore).toBeNull()
	})

	test('low input coverage cannot create passive penalty', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(50, (index) => ({
				telemetry: index < 5 ? passiveTelemetry() : null,
			})),
			personalBestCount: 50,
		})

		expect(result.metrics.inputCoverage).toBe(0.1)
		expect(result.metrics.passivePlaySeverity).toBe(0)
		expect(result.factors.passivePlayFactor).toBe(1)
	})

	test('does not trust zero-filled input statistics without explicit capability', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(30, () => ({
				telemetry: passiveTelemetry({ hasInputData: null }),
			})),
			personalBestCount: 30,
		})

		expect(result.metrics.inputSampleSize).toBe(0)
		expect(result.metrics.inputCoverage).toBe(0)
		expect(result.metrics.passivePlaySeverity).toBeNull()
		expect(result.metrics.afkModifier).toBeNull()
		expect(result.factors.passivePlayFactor).toBe(1)
	})

	test('slow passive finish has negligible effect when top ten is active', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(30, (index) => ({
				time: index === 29 ? 120 : 60 + index * 0.1,
				telemetry:
					index === 29
						? passiveTelemetry({ time: 120 })
						: activeTelemetry({ time: 60 + index * 0.1 }),
			})),
			personalBestCount: 30,
		})

		expect(result.metrics.passiveTop10Share).toBe(0)
		expect(result.metrics.passivePlaySeverity).toBeLessThan(0.001)
		expect(result.factors.passivePlayFactor).toBeGreaterThan(0.999)
	})

	test('returns descriptive telemetry without duplicating four-wheel share', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(5, () => ({
				telemetry: activeTelemetry({
					hasAirData: true,
					hasStateData: true,
					timeInAir: 12,
					timeOnGround: 48,
					distance: 1_000,
					averageSpeed: 100,
				}),
			})),
		})

		expect(result.metrics.typicalAirTimeShare).toBeCloseTo(0.2)
		expect(result.metrics.typicalGroundTimeShare).toBeCloseTo(0.8)
		expect(result.metrics.typicalDistance).toBe(1_000)
		expect('typicalFourWheelShare' in result.metrics).toBe(false)
	})

	test('ignores descriptive telemetry values without matching capability', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(5, () => ({
				telemetry: activeTelemetry({
					hasAirData: false,
					hasSlipData: false,
					hasRagdollData: false,
					hasSurfaceData: false,
					hasVelocityData: false,
					timeInAir: 12,
					timeOnGround: 48,
					timeSlipping: 3,
					timeRagdoll: 2,
					timeOnTarmac: 60,
					averageAngularVelocity: 4,
					averageGforce: 2,
				}),
			})),
		})

		expect(result.metrics.airSampleSize).toBe(0)
		expect(result.metrics.slipSampleSize).toBe(0)
		expect(result.metrics.ragdollSampleSize).toBe(0)
		expect(result.metrics.surfaceSampleSize).toBe(0)
		expect(result.metrics.velocitySampleSize).toBe(0)
		expect(result.metrics.typicalAirTimeShare).toBeNull()
		expect(result.metrics.typicalGroundTimeShare).toBeNull()
		expect(result.metrics.typicalSlipShare).toBeNull()
		expect(result.metrics.typicalRagdollShare).toBeNull()
		expect(result.metrics.surfaceDiversityScore).toBeNull()
		expect(result.metrics.typicalAverageAngularVelocity).toBeNull()
		expect(result.metrics.typicalAverageGforce).toBeNull()
	})

	test('uses no more than top 50 supplied personal bests', () => {
		const result = calculateLevelPoints({
			personalBests: personalBests(100),
			personalBestCount: 100,
		})

		expect(result.metrics.sampleSize).toBe(50)
	})

	test('keeps legacy job input callable during adapter migration', () => {
		const result = calculateLevelPoints({
			topTimes: [60, 61, 62, 63, 64],
			personalBests: 5,
			rating: 0.5,
			personalBestCountPercentile: 100,
		})

		expect(result.points).toBeGreaterThan(0)
		expect(result.modifiers.lengthModifier).toBe(result.factors.lengthFactor)
		expect(result.modifiers.competitivenessModifier).toBeCloseTo(
			0.1 + 1.9 * result.factors.competitiveMerit,
		)
	})
})
