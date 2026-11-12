import { describe, expect, it } from 'vitest'
import { MEDALS, MedalTier, mapMedalCounts } from '../../app/utils/medals'

describe('medal distribution', () => {
	it('keeps stable tier codes, descending display order, and available artwork', () => {
		expect(MEDALS.map((medal) => medal.tier)).toEqual([5, 4, 3, 2, 1, 0])
		expect(MedalTier.Apex).toBe(5)
		expect(MedalTier.Bronze).toBe(0)
	})
	it('maps exclusive cached counts without adding WR ownership to the distribution', () => {
		const counts = mapMedalCounts({
			medalApex: 3,
			medalExpert: 8,
			medalAuthor: 500,
			medalGold: 399,
			medalSilver: 399,
			medalBronze: 3940,
			medalNone: 393,
		})
		expect(Object.values(counts).reduce((sum, count) => sum + count, 0)).toBe(5642)
		expect(counts).toEqual({
			apex: 3,
			expert: 8,
			author: 500,
			gold: 399,
			silver: 399,
			bronze: 3940,
			none: 393,
		})
	})
	it('uses zero counts for accounts without cached PBs', () => {
		expect(Object.values(mapMedalCounts()).every((count) => count === 0)).toBe(true)
	})
})
