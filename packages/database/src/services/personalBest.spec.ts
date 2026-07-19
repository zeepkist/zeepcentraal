import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

const service = readFileSync(new URL('./personalBest.ts', import.meta.url), 'utf8')

describe('level score participation reference', () => {
	test('includes eligible levels with zero personal bests', () => {
		const percentileQuery = service.slice(service.indexOf('getPersonalBestCount90thPercentile'))

		expect(percentileQuery).toContain('.from(level)')
		expect(percentileQuery).toContain('.leftJoin(personalBestGlobal')
		expect(percentileQuery).toMatch(/sql<number>`COUNT\(\$\{user\.id\}\)`/)
		expect(percentileQuery).toContain('eq(user.banned, false)')
		expect(percentileQuery).toContain('STEAM_ACCESSIBLE_VISIBILITIES')
		expect(percentileQuery).not.toContain('.from(personalBestGlobal)')
	})
})
