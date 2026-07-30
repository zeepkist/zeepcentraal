import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')
const config = read('../../nuxt.config.ts')
const css = read('../../app/assets/css/tailwind.css')
const layout = read('../../app/layouts/default.vue')
const plugin = read('../../app/plugins/shared-view-transitions.client.ts')
const composable = read('../../app/composables/useSharedViewTransition.ts')

describe('native shared view transition contract', () => {
	it('enables Nuxt native transitions while respecting reduced motion', () => {
		expect(config).toContain('viewTransition: true')
		expect(composable).toContain("matchMedia('(prefers-reduced-motion: reduce)')")
		expect(css).toContain('@media (prefers-reduced-motion: reduce)')
		expect(css).toContain('::view-transition-group(*)')
	})

	it('animates named content while shell stays outside its snapshot', () => {
		expect(layout).toContain('class="app-page-content min-w-0 flex-1 px-4 py-5"')
		expect(css).toContain('view-transition-name: page-content')
		expect(css).toContain('view-transition-name: none')
		expect(css).toContain('page-content-out 180ms cubic-bezier(0.2, 0, 0, 1)')
		expect(css).toContain('page-content-in 240ms cubic-bezier(0.2, 0, 0, 1)')
		expect(css).not.toMatch(/transform: translateY\([^)]*\) scale/)
		expect(css).toContain('animation-duration: 360ms')
		expect(css).toContain('::view-transition-group(shared-title)')
		expect(css).toContain('animation-duration: 280ms')
	})

	it('adds runtime direction types and clears failed or unrelated selections', () => {
		expect(plugin).toContain('types?.add(activeDirection)')
		expect(plugin).toContain("activeDirection === 'detail-back'")
		expect(plugin).toContain('if (direction)')
		expect(plugin).toContain('await nextTick()')
		expect(plugin).toContain('if (!transitionState.selection.value) return')
		expect(plugin).toContain('if (failure)')
		expect(plugin).toContain('router.onError')
	})

	it.each([
		['level card', '../../app/components/level/LevelCard.vue', "entity: 'level'"],
		['mod card', '../../app/components/mod/ModCard.vue', "entity: 'mod'"],
		[
			'tournament card',
			'../../app/components/tournament/TournamentCard.vue',
			"entity: 'tournament'",
		],
		[
			'tournament feature card',
			'../../app/components/tournament/TournamentFeatureCard.vue',
			"entity: 'tournament'",
		],
		['user table', '../../app/components/user/UserLeaderboardTable.vue', "entity: 'user'"],
		['record table', '../../app/components/record/RecordHistoryTable.vue', "entity: 'record'"],
		['Super League card', '../../app/components/zsl/ZslCard.vue', 'sharedTransition'],
	])('%s owns explicit source activation', (_name, path, marker) => {
		const source = read(path)
		expect(source).toContain('@click.capture')
		expect(source).toContain(marker)
		expect(source).toMatch(/transitionScope|scope: string/)
	})

	it.each([
		['level hero', '../../app/components/level/LevelDetailHero.vue'],
		['mod hero', '../../app/components/mod/ModDetailHero.vue'],
		['tournament hero', '../../app/components/tournament/TournamentEvent.vue'],
		['user hero', '../../app/components/user/UserDetailHero.vue'],
		['record hero', '../../app/components/record/RecordDetailHero.vue'],
		['Super League level hero', '../../app/components/zsl/ZslLevelHero.vue'],
	])('%s exposes shared target', (_name, path) => {
		const source = read(path)
		expect(source).toContain('targetStyle(')
		expect(source).toContain('data-shared-transition-target')
	})

	it('uses explicit placement scopes for reusable collections', () => {
		for (const path of [
			'../../app/pages/index.vue',
			'../../app/pages/levels.vue',
			'../../app/pages/mods.vue',
			'../../app/pages/users.vue',
			'../../app/pages/records/index.vue',
			'../../app/pages/records/me.vue',
			'../../app/pages/super-league/index.vue',
			'../../app/pages/super-league/[seasonSlug]/index.vue',
			'../../app/pages/super-league/[seasonSlug]/[roundSlug]/index.vue',
		]) {
			expect(read(path)).toContain('transition-scope')
		}
	})
})
