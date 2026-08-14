import { describe, expect, test } from 'bun:test'
import {
	calculateVoteRating,
	calculateVoteScore,
	DEFAULT_VOTE_RATING,
	getVoteRatingMaturityCutoff,
	NEGATIVE_VOTE_WEIGHT,
	VOTE_RATING_MATURITY_MS,
} from './calculateVoteRating'

describe('calculateVoteScore', () => {
	test('makes positive votes twice as strong as equivalent negative votes', () => {
		expect(NEGATIVE_VOTE_WEIGHT).toBe(0.5)
		expect(calculateVoteScore(-2)).toBe(0.25)
		expect(calculateVoteScore(-1)).toBe(0.375)
		expect(calculateVoteScore(1)).toBe(0.75)
		expect(calculateVoteScore(2)).toBe(1)
		expect(calculateVoteScore(1) - DEFAULT_VOTE_RATING).toBe(
			2 * (DEFAULT_VOTE_RATING - calculateVoteScore(-1)),
		)
		expect(calculateVoteScore(2) - DEFAULT_VOTE_RATING).toBe(
			2 * (DEFAULT_VOTE_RATING - calculateVoteScore(-2)),
		)
	})

	test('clamps out-of-range votes and neutralizes invalid values', () => {
		expect(calculateVoteScore(-3)).toBe(calculateVoteScore(-2))
		expect(calculateVoteScore(3)).toBe(calculateVoteScore(2))
		expect(calculateVoteScore(Number.NaN)).toBe(DEFAULT_VOTE_RATING)
	})
})

describe('calculateVoteRating', () => {
	test('uses default rating below five mature votes', () => {
		for (let voteCount = 0; voteCount < 5; voteCount++) {
			expect(calculateVoteRating(Array.from({ length: voteCount }, () => 2))).toBe(
				DEFAULT_VOTE_RATING,
			)
		}
		expect(calculateVoteRating([1, -2])).toBe(DEFAULT_VOTE_RATING)
	})

	test('averages mature votes with positive weighting', () => {
		expect(calculateVoteRating([1, 1, 1, 1, 1])).toBe(0.75)
		expect(calculateVoteRating([2, 2, 2, 2, 2])).toBe(1)
		expect(calculateVoteRating([1, 1, 1, 1, -1])).toBe(0.675)
		expect(calculateVoteRating([1, 1, 1, 1, -2])).toBe(0.65)
		expect(calculateVoteRating([2, 2, 2, 1, 1, -1, -2])).toBe(0.732143)
		expect(calculateVoteRating([1, 1, 1, -2, -2])).toBe(0.55)
		expect(calculateVoteRating([0, 0, 0, 0, 0])).toBe(0.5)
		expect(calculateVoteRating([-1, -1, -1, -1, -1])).toBe(0.375)
		expect(calculateVoteRating([-2, -2, -2, -2, -2])).toBe(0.25)
	})

	test('is independent of vote order', () => {
		expect(calculateVoteRating([2, 2, 2, 1, 1, -1, -2])).toBe(
			calculateVoteRating([-2, 1, 2, -1, 2, 1, 2]),
		)
	})

	test('uses clamped and neutralized vote scores in rating', () => {
		expect(calculateVoteRating([-3, 3, 1, 0, Number.NaN])).toBe(
			calculateVoteRating([-2, 2, 1, 0, 0]),
		)
	})
})

describe('getVoteRatingMaturityCutoff', () => {
	test('returns timestamp exactly seven days before batch snapshot', () => {
		const now = Date.parse('2026-07-17T12:00:00.000Z')
		expect(VOTE_RATING_MATURITY_MS).toBe(604_800_000)
		expect(getVoteRatingMaturityCutoff(now)).toBe('2026-07-10T12:00:00.000Z')
	})
})
