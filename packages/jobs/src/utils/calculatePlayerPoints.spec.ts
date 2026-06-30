import { describe, expect, test } from 'bun:test'
import {
	calculatePlayerPoints,
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

	test('caps ranked point calculation to top 300 PBs', () => {
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

	test('caps contribution output to top 200 PBs', () => {
		const personalBests = Array.from(
			{ length: PLAYER_SCORE_CONTRIBUTION_LIMIT + 1 },
			(_, index) => ({
				idLevel: index + 1,
				idRecord: index + 10_000,
				levelPoints: 1000 - index,
				position: 1n,
			}),
		)

		const result = calculatePlayerPoints(personalBests)

		expect(result.contributions).toHaveLength(PLAYER_SCORE_CONTRIBUTION_LIMIT)
		expect(result.contributions[0]?.idLevel).toBe(1)
		expect(result.contributions.at(-1)?.idLevel).toBe(PLAYER_SCORE_CONTRIBUTION_LIMIT)
	})
})
