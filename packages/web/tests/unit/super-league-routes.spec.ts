import { describe, expect, it } from 'vitest'
import {
	parseSuperLeagueSlug,
	superLeagueLevelPath,
	superLeagueRoundPath,
	superLeagueSeasonPath,
} from '../../app/utils/superLeagueRoutes'

describe('Super League routes', () => {
	it('parses strict positive prefixed identifiers', () => {
		expect(parseSuperLeagueSlug('season-7', 'season')).toBe(7)
		expect(parseSuperLeagueSlug('round-1', 'round')).toBe(1)
		expect(parseSuperLeagueSlug('level-615', 'level')).toBe(615)
	})

	it('rejects malformed identifiers', () => {
		expect(parseSuperLeagueSlug('7', 'season')).toBeNull()
		expect(parseSuperLeagueSlug('season-0', 'season')).toBeNull()
		expect(parseSuperLeagueSlug('season--7', 'season')).toBeNull()
		expect(parseSuperLeagueSlug(['season-7'], 'season')).toBeNull()
	})

	it('builds semantic hierarchy paths', () => {
		expect(superLeagueSeasonPath(7)).toBe('/super-league/season-7')
		expect(superLeagueRoundPath(7, 1)).toBe('/super-league/season-7/round-1')
		expect(superLeagueLevelPath(7, 1, 615)).toBe('/super-league/season-7/round-1/level-615')
	})
})
