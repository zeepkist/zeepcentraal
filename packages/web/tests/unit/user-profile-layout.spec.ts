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
	it('places career content and sidebar in requested desktop columns', () => {
		expect(page).toContain('<DetailSectionTabs')
		expect(page).toContain('v-model="activeTab"')
		expect(page).toContain(':items="profileTabs"')
		expect(page).toContain(':label="$t(\'users.profile.tabs.label\')"')
		expect(page).toContain("const activeTab = ref<UserProfileTab>('career')")

		expect(page).toContain(
			'class="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start"',
		)
		expect(page).toContain('class="min-w-0 space-y-8 lg:space-y-10"')
		expect(page).toContain('<aside class="space-y-8 lg:space-y-10">')

		const careerStart = page.indexOf('<template #career>')
		const recordsStart = page.indexOf('<template #records>')
		const leftIds = ['profile-history', 'profile-telemetry']
		const leftPositions = leftIds.map((id) => page.indexOf(`id="${id}"`))
		expect(leftPositions.every((position) => position > careerStart)).toBe(true)
		expect(leftPositions).toEqual([...leftPositions].sort((left, right) => left - right))

		const sidebarIds = [
			'profile-summary',
			'profile-super-league',
			'profile-achievements',
			'profile-cosmetics',
		]
		const sidebarPositions = sidebarIds.map((id) => page.indexOf(`id="${id}"`))
		expect(sidebarPositions.every((position) => position > careerStart)).toBe(true)
		expect(sidebarPositions.every((position) => position < recordsStart)).toBe(true)
		expect(sidebarPositions).toEqual([...sidebarPositions].sort((left, right) => left - right))
		expect(Math.max(...leftPositions)).toBeLessThan(Math.min(...sidebarPositions))
	})

	it('groups full-width records and workshop collections into force-mounted tabs', () => {
		const recordsStart = page.indexOf('<template #records>')
		const workshopStart = page.indexOf('<template #workshop>')
		const recordsPositions = [
			'profile-world-records',
			'profile-personal-bests',
			'profile-recent',
		].map((id) => page.indexOf(`id="${id}"`))
		const workshopPositions = ['profile-popular-levels', 'profile-recent-levels'].map((id) =>
			page.indexOf(`id="${id}"`),
		)

		expect(recordsPositions.every((position) => position > recordsStart)).toBe(true)
		expect(recordsPositions.every((position) => position < workshopStart)).toBe(true)
		expect(recordsPositions).toEqual([...recordsPositions].sort((left, right) => left - right))
		expect(workshopPositions.every((position) => position > workshopStart)).toBe(true)
		expect(workshopPositions).toEqual(
			[...workshopPositions].sort((left, right) => left - right),
		)
		expect(page).not.toContain('xl:grid-cols-2 xl:items-start')
	})

	it('keeps every deferred section observer inside its tab panel', () => {
		for (const target of [
			'statisticsTarget',
			'personalBestsTarget',
			'levelsTarget',
			'recentTarget',
		]) {
			expect(page).toContain(`:ref="data.${target}"`)
		}
		expect(page).not.toContain('pointsHistoryTarget')
		expect(page).not.toContain('worldRecordsTarget')
	})

	it('uses translated hydration-stable local tab options', () => {
		expect(page).toContain("t('users.profile.tabs.career')")
		expect(page).toContain("t('users.profile.tabs.records')")
		expect(page).toContain("t('users.profile.tabs.workshopLevels')")
		expect(page).toContain("t('users.profile.tabs.favouriteLevels')")
		expect(page).toContain("value: 'career'")
		expect(page).toContain("value: 'records'")
		expect(page).toContain("value: 'workshop'")
		expect(page).toContain("value: 'favourites'")
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
