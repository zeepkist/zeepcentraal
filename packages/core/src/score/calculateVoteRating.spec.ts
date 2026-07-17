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
	test('makes positive votes stronger than equivalent negative votes', () => {
		expect(NEGATIVE_VOTE_WEIGHT).toBe(0.75)
		expect(calculateVoteScore(-2)).toBe(0.125)
		expect(calculateVoteScore(-1)).toBe(0.3125)
		expect(calculateVoteScore(1)).toBe(0.75)
		expect(calculateVoteScore(2)).toBe(1)
		expect(calculateVoteScore(-1) + calculateVoteScore(1)).toBeGreaterThan(1)
		expect(calculateVoteScore(-2) + calculateVoteScore(2)).toBeGreaterThan(1)
	})

	test('clamps out-of-range votes and neutralizes invalid values', () => {
		expect(calculateVoteScore(-3)).toBe(calculateVoteScore(-2))
		expect(calculateVoteScore(3)).toBe(calculateVoteScore(2))
		expect(calculateVoteScore(Number.NaN)).toBe(DEFAULT_VOTE_RATING)
	})
})

describe('calculateVoteRating', () => {
	test('uses default rating when no mature votes exist', () => {
		expect(calculateVoteRating([])).toBe(DEFAULT_VOTE_RATING)
	})

	test('retains Wilson lower-bound ranking with positive skew', () => {
		expect(calculateVoteRating([-1, 1])).toBeGreaterThan(calculateVoteRating([0, 0]))
		expect(calculateVoteRating([-2, 2])).toBeGreaterThan(calculateVoteRating([0, 0]))
		expect(calculateVoteRating([2, 2])).toBe(0.666667)
	})
})

describe('getVoteRatingMaturityCutoff', () => {
	test('returns timestamp exactly seven days before batch snapshot', () => {
		const now = Date.parse('2026-07-17T12:00:00.000Z')
		expect(VOTE_RATING_MATURITY_MS).toBe(604_800_000)
		expect(getVoteRatingMaturityCutoff(now)).toBe('2026-07-10T12:00:00.000Z')
	})
})
