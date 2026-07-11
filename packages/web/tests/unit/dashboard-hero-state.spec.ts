import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveDashboardHeroState } from '../../app/utils/dashboardHero'

describe('dashboard hero state', () => {
	it('keeps authenticated players pending until viewer data resolves', () => {
		expect(resolveDashboardHeroState(true, false)).toBe('pending')
	})

	it('shows setup after viewer summary confirms zero records', () => {
		expect(resolveDashboardHeroState(true, true, 0)).toBe('new-player')
	})

	it('gates hero state on viewer summary, not season standing', () => {
		const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
		const callStart = page.indexOf('const state = resolveDashboardHeroState(')
		const callEnd = page.indexOf("if (state === 'anonymous')", callStart)
		const readinessBlock = page.slice(callStart, callEnd)
		expect(readinessBlock).toContain('dashboard.viewerQuery.data.value')
		expect(readinessBlock).not.toContain('viewerStandingQuery')
	})

	it('shows the active state for players with records', () => {
		expect(resolveDashboardHeroState(true, true, 1)).toBe('active-player')
	})

	it('does not wait for viewer data when logged out', () => {
		expect(resolveDashboardHeroState(false, false)).toBe('anonymous')
	})
})
