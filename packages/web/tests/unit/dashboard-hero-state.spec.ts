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

	it('shows setup when resolved summary has no public viewer row', () => {
		expect(resolveDashboardHeroState(true, true, undefined)).toBe('new-player')
	})

	it('gates hero state on viewer summary, not season standing', () => {
		const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
		const callStart = page.indexOf('const state = resolveDashboardHeroState(')
		const callEnd = page.indexOf("if (state === 'anonymous')", callStart)
		const readinessBlock = page.slice(callStart, callEnd)
		expect(readinessBlock).toContain('dashboard.viewerQuery.data.value')
		expect(readinessBlock).not.toContain('viewerStandingQuery')
	})

	it('renders new-player before applying the active viewer guard', () => {
		const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
		expect(page.indexOf("if (state === 'new-player')")).toBeLessThan(
			page.indexOf('if (!viewer)'),
		)
	})

	it('wires anonymous Steam and Discord login actions through the page', () => {
		const page = readFileSync(new URL('../../app/pages/index.vue', import.meta.url), 'utf8')
		const hero = readFileSync(
			new URL('../../app/components/dashboard/DashboardHero.vue', import.meta.url),
			'utf8',
		)
		expect(page).toContain('<DashboardHero v-bind="hero" @login="login" />')
		expect(page).toContain('const { login } = useAccountActions()')
		expect(hero).toContain("$emit('login', 'steam')")
		expect(hero).toContain("$emit('login', 'discord')")
		expect(hero).toContain('lg:items-stretch')
		expect(hero).toContain('flex-col justify-center')
		expect(hero).toContain('lg:absolute')
		expect(hero).toContain('lg:bottom-0')
		expect(hero).toContain('color="primary"')
		expect(hero).toContain('color="secondary"')
	})

	it('shows the active state for players with records', () => {
		expect(resolveDashboardHeroState(true, true, 1)).toBe('active-player')
	})

	it('does not wait for viewer data when logged out', () => {
		expect(resolveDashboardHeroState(false, false)).toBe('anonymous')
	})
})
