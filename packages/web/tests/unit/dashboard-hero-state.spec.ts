import { describe, expect, it } from 'vitest'
import { resolveDashboardHeroState } from '../../app/utils/dashboardHero'

describe('dashboard hero state', () => {
	it('keeps authenticated players pending until viewer data resolves', () => {
		expect(resolveDashboardHeroState(true, false)).toBe('pending')
	})

	it('only shows the setup state after zero records are confirmed', () => {
		expect(resolveDashboardHeroState(true, true, 0)).toBe('new-player')
	})

	it('shows the active state for players with records', () => {
		expect(resolveDashboardHeroState(true, true, 1)).toBe('active-player')
	})

	it('does not wait for viewer data when logged out', () => {
		expect(resolveDashboardHeroState(false, false)).toBe('anonymous')
	})
})
