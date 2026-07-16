import { describe, expect, test } from 'bun:test'
import {
	calculateDecayMultiplier,
	calculatePlayerPoints,
	calculatePlayerPointsDecayed,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
	PLAYER_SCORE_CONTRIBUTION_LIMIT,
	PLAYER_SCORE_PB_LIMIT,
} from './calculatePlayerPoints'

describe('calculatePlayerPoints', () => {
	test('uses level decay before global decay', () => {
		const result = calculatePlayerPoints([
			{ idLevel: 1, idRecord: 10, levelPoints: 1000, position: 2n },
			{ idLevel: 2, idRecord: 20, levelPoints: 1000, position: 1n },
		])

		expect(result.totalPoints).toBe(1985)
		expect(result.points).toBe(1936)
		expect(result.contributions.map((contribution) => contribution.idLevel)).toEqual([2, 1])
		expect(result.contributions[0]).toMatchObject({
			idLevel: 2,
			idRecord: 20,
			contributionRank: 1,
			levelPosition: 1,
			levelPoints: 1000,
			levelDecayedPoints: 1000,
			playerDecayedPoints: 1000,
		})
		expect(result.contributions[1]?.levelDecayedPoints).toBeCloseTo(985)
		expect(result.contributions[1]?.playerDecayedPoints).toBeCloseTo(935.75)
	})

	test('caps ranked point calculation to configured PB limit', () => {
		const personalBests = Array.from({ length: PLAYER_SCORE_PB_LIMIT + 1 }, (_, index) => ({
			idLevel: index + 1,
			idRecord: index + 10_000,
			levelPoints: 100,
			position: 1n,
		}))

		const capped = calculatePlayerPoints(personalBests)
		const exactLimit = calculatePlayerPoints(personalBests.slice(0, PLAYER_SCORE_PB_LIMIT))

		expect(capped.points).toBe(exactLimit.points)
		expect(capped.totalPoints).toBe(PLAYER_SCORE_PB_LIMIT * 100)
	})

	test('caps contribution output to configured contribution limit', () => {
		const personalBests = Array.from(
			{ length: PLAYER_SCORE_CONTRIBUTION_LIMIT + 1 },
			(_, index) => ({
				idLevel: index + 1,
				idRecord: index + 10_000,
				levelPoints: PLAYER_SCORE_CONTRIBUTION_LIMIT + 1 - index,
				position: 1n,
			}),
		)

		const result = calculatePlayerPoints(personalBests)

		expect(result.contributions).toHaveLength(PLAYER_SCORE_CONTRIBUTION_LIMIT)
		expect(result.contributions[0]?.idLevel).toBe(1)
		expect(result.contributions.at(-1)?.idLevel).toBe(PLAYER_SCORE_CONTRIBUTION_LIMIT)
	})
})

describe('calculateDecayMultiplier', () => {
	test('uses shared level and global decay factors', () => {
		expect(calculateDecayMultiplier(1, LEVEL_DECAY_FACTOR)).toBe(1)
		expect(calculateDecayMultiplier(2, LEVEL_DECAY_FACTOR)).toBeCloseTo(0.985)
		expect(calculateDecayMultiplier(2, GLOBAL_DECAY_FACTOR)).toBeCloseTo(0.95)
	})

	test('returns zero for invalid positions', () => {
		expect(calculateDecayMultiplier(0, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculateDecayMultiplier(Number.NaN, LEVEL_DECAY_FACTOR)).toBe(0)
	})
})

describe('calculatePlayerPointsDecayed', () => {
	test('applies level decay to points at leaderboard position', () => {
		expect(calculatePlayerPointsDecayed(1000, 1, LEVEL_DECAY_FACTOR)).toBe(1000)
		expect(calculatePlayerPointsDecayed(1000, 2, LEVEL_DECAY_FACTOR)).toBeCloseTo(985)
	})

	test('returns zero for invalid points and positions', () => {
		expect(calculatePlayerPointsDecayed(0, 1, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculatePlayerPointsDecayed(Number.NaN, 1, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculatePlayerPointsDecayed(1000, 0, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculatePlayerPointsDecayed(1000, Number.NaN, LEVEL_DECAY_FACTOR)).toBe(0)
	})
})
