import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const page = readFileSync(new URL('../../app/pages/user/[steamid].vue', import.meta.url), 'utf8')
const achievements = readFileSync(
	new URL('../../app/components/user/UserAchievementShowcase.vue', import.meta.url),
	'utf8',
)
const cosmetics = readFileSync(
	new URL('../../app/components/user/UserCosmeticsShowcase.vue', import.meta.url),
	'utf8',
)
const translations = JSON.parse(
	readFileSync(new URL('../../i18n/locales/en.json', import.meta.url), 'utf8'),
)

describe('user profile layout', () => {
	it('places activity and sidebar content in requested desktop columns', () => {
		expect(page).toContain(
			'class="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start"',
		)
		expect(page).toContain('class="min-w-0 space-y-8 lg:space-y-10"')
		expect(page).toContain('<aside class="space-y-8 lg:space-y-10">')

		const leftIds = [
			'profile-history',
			'profile-world-records',
			'profile-telemetry',
			'profile-personal-bests',
			'profile-popular-levels',
			'profile-recent',
			'profile-recent-levels',
		]
		const leftPositions = leftIds.map((id) => page.indexOf(`id="${id}"`))
		expect(leftPositions.every((position) => position >= 0)).toBe(true)
		expect(leftPositions).toEqual([...leftPositions].sort((left, right) => left - right))

		const sidebarIds = [
			'profile-summary',
			'profile-super-league',
			'profile-achievements',
			'profile-cosmetics',
		]
		const sidebarPositions = sidebarIds.map((id) => page.indexOf(`id="${id}"`))
		expect(sidebarPositions.every((position) => position >= 0)).toBe(true)
		expect(sidebarPositions).toEqual([...sidebarPositions].sort((left, right) => left - right))
		expect(Math.max(...leftPositions)).toBeLessThan(Math.min(...sidebarPositions))
	})

	it('keeps every deferred section observer on left-column content', () => {
		for (const target of [
			'pointsHistoryTarget',
			'worldRecordsTarget',
			'statisticsTarget',
			'personalBestsTarget',
			'levelsTarget',
			'recentTarget',
		]) {
			expect(page).toContain(`:ref="data.${target}"`)
		}
	})

	it('renders request-free achievement preview badges in responsive columns', () => {
		expect(achievements).toContain('grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-3')
		expect(achievements).toContain('v-for="achievement in achievements"')
		expect(achievements).toContain('{{ labels.comingSoon }}')
		expect(achievements).not.toContain('useQuery')
		expect(achievements).not.toContain('group-hover')

		for (const key of [
			'records',
			'personalBests',
			'worldRecords',
			'fastestSpeed',
			'levels',
			'superLeague',
			'points',
			'driving',
			'surfaces',
		]) {
			expect(translations.users.profile.achievements.items[key]).toBeTruthy()
		}
	})

	it('renders unavailable cosmetic progress and both category previews', () => {
		expect(cosmetics).toContain('<UProgress')
		expect(cosmetics).toContain('progress.percentage ?? 0')
		expect(cosmetics).toContain('category.rarest ?? labels.unavailable')
		expect(cosmetics).toContain('category.mostUsed ?? labels.unavailable')
		expect(cosmetics).not.toContain('useQuery')

		for (const key of ['hats', 'glasses', 'skinColours', 'soapboxes', 'wheels']) {
			expect(translations.users.profile.cosmetics.categories[key]).toBeTruthy()
		}
	})
})
