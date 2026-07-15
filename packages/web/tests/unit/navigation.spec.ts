import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import {
	isNavigationTargetActive,
	mainNav,
	navigationRouteFamilies,
} from '../../app/utils/navigation'
import { parseSidebarOpenPreference } from '../../app/utils/sidebarPreference'

const sidebar = readFileSync(
	new URL('../../app/components/layout/AppSidebar.vue', import.meta.url),
	'utf8',
)
const header = readFileSync(
	new URL('../../app/components/layout/AppHeader.vue', import.meta.url),
	'utf8',
)
const footer = readFileSync(
	new URL('../../app/components/layout/AppFooter.vue', import.meta.url),
	'utf8',
)

const en = JSON.parse(
	readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'),
) as {
	nav: Record<string, string>
	navDescriptions: Record<string, string>
}

function resolveKey(source: Record<string, unknown>, key: string): unknown {
	return key.split('.').reduce<unknown>((current, segment) => {
		if (current && typeof current === 'object' && segment in current) {
			return (current as Record<string, unknown>)[segment]
		}

		return undefined
	}, source)
}

describe('navigation model', () => {
	test('uses route keys that resolve through i18n', () => {
		for (const item of mainNav) {
			expect(item.to.startsWith('/')).toBe(true)
			expect(resolveKey(en, item.labelKey)).toBeTypeOf('string')
			expect(resolveKey(en, item.descriptionKey ?? item.labelKey)).toBeTypeOf('string')
		}
	})

	test('uses SSR-readable cookie state for sidebar preference', () => {
		expect(sidebar).toContain("useCookie<boolean | null>('sidebar-open'")
		expect(sidebar).toContain('const open = ref(sidebarPreference.value ?? true)')
		expect(sidebar).toContain('sidebarPreference.value = value')
		expect(sidebar).not.toContain('onMounted(() => {')
		expect(sidebar).not.toContain('useLocalStorage')
		expect(sidebar).not.toContain('localStorage')
	})

	test('parses legacy sidebar preference values', () => {
		expect(parseSidebarOpenPreference('true')).toBe(true)
		expect(parseSidebarOpenPreference('false')).toBe(false)
		expect(parseSidebarOpenPreference('invalid')).toBeNull()
		expect(parseSidebarOpenPreference(null)).toBeNull()
	})

	test.each([
		['/super-league/season-7', '/super-league'],
		['/super-league/season-7/round-1', '/super-league'],
		['/super-league/season-7/round-1/level-615', '/super-league'],
		['/user/76561198031919228', '/users'],
		['/level/example-hash', '/levels'],
		['/records/me', '/records'],
		['/record/42', '/records'],
		['/totw/week-30', '/totw'],
		['/totm/2026-07', '/totm'],
		['/wiki/setup-modkist', '/wiki'],
		['/developer/graphql', '/developer'],
		['/mod/zeepkist-gtr', '/mods'],
		['/adventure/xg', '/adventure/a'],
		['/cosmetic/42', '/cosmetics'],
	])('activates %s through parent target %s', (path, target) => {
		expect(isNavigationTargetActive(path, target)).toBe(true)
	})

	test('normalizes trailing slashes, query strings, and hashes', () => {
		expect(isNavigationTargetActive('/records/me/?view=recent#live', '/records/')).toBe(true)
		expect(isNavigationTargetActive('/developer/', '/developer')).toBe(true)
	})

	test.each([
		['/recordings', '/records'],
		['/records-old', '/records'],
		['/userscript', '/users'],
		['/levels-extra', '/levels'],
		['/super-leagues', '/super-league'],
	])('rejects false prefix %s for %s', (path, target) => {
		expect(isNavigationTargetActive(path, target)).toBe(false)
	})

	test('matches home exactly and one primary family per route', () => {
		expect(isNavigationTargetActive('/', '/')).toBe(true)
		expect(isNavigationTargetActive('/records', '/')).toBe(false)

		for (const path of ['/record/42', '/user/1', '/adventure/cl']) {
			const matches = mainNav.filter((item) => isNavigationTargetActive(path, item.to))
			expect(matches).toHaveLength(1)
		}
	})

	test('defines a route family for every main navigation target', () => {
		for (const item of mainNav) {
			expect(navigationRouteFamilies[item.to]).toBeDefined()
		}
	})

	test('uses shared active state in sidebar, mobile navigation, and footer', () => {
		expect(sidebar).toContain("? 'location' : undefined")
		expect(sidebar).toContain('isNavigationTargetActive(route.path, item.to)')
		expect(sidebar).not.toContain('active-class=')
		expect(header).toContain('active: isNavigationTargetActive(route.path, item.to)')
		expect(footer).toContain('active: isNavigationTargetActive(route.path, to)')
	})

	test('slides the header logo smoothly with reduced-motion support', () => {
		expect(header).toContain("sidebarPreference ? 'grid-cols-[0fr]' : 'grid-cols-[1fr]'")
		expect(header).toContain('transition-[grid-template-columns]')
		expect(header).toContain(
			"sidebarPreference ? 'pointer-events-none -translate-x-full opacity-0' : 'translate-x-0 opacity-100'",
		)
		expect(header).toContain('transition-[transform,opacity]')
		expect(header).toContain('motion-reduce:transition-none')
		expect(header).toContain(':aria-hidden="sidebarPreference"')
	})
})
