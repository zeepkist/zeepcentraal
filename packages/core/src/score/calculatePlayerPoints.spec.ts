import { describe, expect, test } from 'bun:test'
import {
	calculateDecayMultiplier,
	calculatePlayerPoints,
	calculatePlayerPointsDecayed,
	calculatePlayerPointsFromContributions,
	GLOBAL_DECAY_FACTOR,
	LEVEL_DECAY_FACTOR,
	MIN_PERSISTED_DECAYED_POINTS,
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

	test('calculates and persists every positive-point personal best', () => {
		const personalBests = Array.from({ length: 2500 }, (_, index) => ({
			idLevel: index + 1,
			idRecord: index + 10_000,
			levelPoints: 100,
			position: 1n,
		}))

		const result = calculatePlayerPoints(personalBests)

		expect(result.contributions).toHaveLength(2500)
		expect(result.totalPoints).toBe(250_000)
		expect(result.contributions.at(-1)?.contributionRank).toBe(2500)
		expect(result.contributions.at(-1)?.playerDecayedPoints).toBe(0)
	})

	test('recalculates only player-owned fields from projected level contributions', () => {
		const result = calculatePlayerPointsFromContributions([
			{
				idLevel: 2,
				idRecord: 20,
				levelPosition: 2,
				levelPoints: 1000,
				levelDecayedPoints: 985,
			},
			{
				idLevel: 1,
				idRecord: 10,
				levelPosition: 1,
				levelPoints: 1000,
				levelDecayedPoints: 1000,
			},
		])

		expect(result.points).toBe(1936)
		expect(result.totalPoints).toBe(1985)
		expect(
			result.contributions.map(({ idLevel, contributionRank }) => ({
				idLevel,
				contributionRank,
			})),
		).toEqual([
			{ idLevel: 1, contributionRank: 1 },
			{ idLevel: 2, contributionRank: 2 },
		])
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

	test('clamps positive values below PostgreSQL real precision to zero', () => {
		expect(
			calculatePlayerPointsDecayed(MIN_PERSISTED_DECAYED_POINTS, 1, GLOBAL_DECAY_FACTOR),
		).toBe(MIN_PERSISTED_DECAYED_POINTS)
		expect(calculatePlayerPointsDecayed(100, 2500, GLOBAL_DECAY_FACTOR)).toBe(0)
	})

	test('returns zero for invalid points and positions', () => {
		expect(calculatePlayerPointsDecayed(0, 1, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculatePlayerPointsDecayed(Number.NaN, 1, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculatePlayerPointsDecayed(1000, 0, LEVEL_DECAY_FACTOR)).toBe(0)
		expect(calculatePlayerPointsDecayed(1000, Number.NaN, LEVEL_DECAY_FACTOR)).toBe(0)
	})
})
