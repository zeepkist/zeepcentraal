import { describe, expect, test } from 'bun:test'
import { calculateLevelPoints } from './calculateLevelPoints'

describe('calculateLevelPoints', () => {
	test('returns zero when level has no personal bests', () => {
		expect(
			calculateLevelPoints({
				topTimes: [],
				personalBests: 0,
				rating: 0.5,
				personalBestCountPercentile: 0,
			}),
		).toEqual({
			points: 0,
			modifiers: {
				lengthModifier: 0,
				competitivenessModifier: 0,
				ratingModifier: 0,
				popularityModifier: 0,
				cutPenalty: 0,
			},
		})
	})

	test('calculates stable points and modifiers from leaderboard inputs', () => {
		const result = calculateLevelPoints({
			topTimes: [60, 61, 62, 63, 64, 65, 66],
			personalBests: 100,
			rating: 0.8,
			personalBestCountPercentile: 20,
		})

		expect(result.points).toBe(6342)
		expect(result.modifiers.lengthModifier).toBe(1)
		expect(result.modifiers.competitivenessModifier).toBeCloseTo(1.4660904402)
		expect(result.modifiers.ratingModifier).toBe(1.3)
		expect(result.modifiers.popularityModifier).toBe(1.3)
		expect(result.modifiers.cutPenalty).toBe(1)
	})

	test('penalizes suspiciously faster world records', () => {
		const result = calculateLevelPoints({
			topTimes: [10, 30, 30, 30, 30, 30],
			personalBests: 6,
			rating: 0.5,
			personalBestCountPercentile: 10,
		})

		expect(result.points).toBe(1300)
		expect(result.modifiers.cutPenalty).toBe(0.8333333)
	})
})
