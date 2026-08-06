import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getLevelHotWindows } from '../../app/utils/levelExplorer'

const query = readFileSync(
	new URL('../../../graphql/documents/web/queries/userLevels.graphql', import.meta.url),
	'utf8',
)
const collection = readFileSync(
	new URL('../../app/components/user/UserLevelCollection.vue', import.meta.url),
	'utf8',
)
const grid = readFileSync(
	new URL('../../app/components/level/LevelGrid.vue', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useUserLevels.ts', import.meta.url),
	'utf8',
)
const page = readFileSync(
	new URL('../../app/pages/user/[steamid].vue', import.meta.url),
	'utf8',
).replaceAll('<Lazy', '<')

describe('user profile level showcases', () => {
	it('requests exactly six recent non-deleted workshop levels', () => {
		expect(query).toContain('recentUser: user(id: $userId)')
		expect(query).toContain('levelItems(')
		expect(query).toContain('first: 6')
		expect(query).toContain('deleted: { equalTo: false }')
		expect(query).toContain('level: { publiclyVisible: { equalTo: true } }')
		expect(query).toContain('orderBy: [CREATED_AT_DESC]')
	})

	it('requests exactly six author-filtered hot levels over rolling year', () => {
		expect(query).toContain('popularLevels: hotLevelsSince(')
		expect(query).toContain('first: 6')
		expect(query).toContain('since: $since')
		expect(query).toContain('authorId: { equalTo: $steamId }')
		expect(query).toContain('periodRecords: records(')
		expect(query).toContain('dateCreated: { greaterThanOrEqualTo: $since }')
		const windows = getLevelHotWindows(new Date('2026-07-14T12:00:00.000Z'))
		expect(windows.yearSince).toBe('2025-07-14T12:00:00.000Z')
	})

	it('keeps level requests viewport-deferred and maps period record counts', () => {
		expect(composable).toContain('const levelsPrefetch = useViewportPrefetch()')
		expect(composable).toContain('!toValue(active)')
		expect(composable).toContain('!levelsPrefetch.active.value')
		expect(composable).toContain('level.periodRecords.totalCount')
	})

	it('reuses request-free level cards in full-width collections', () => {
		expect(collection).toContain('<LevelGrid')
		expect(collection).toContain(':columns="columns"')
		expect(collection).toContain('{ columns: 3 }')
		expect(collection).not.toContain('useQuery')
		expect(grid).toContain('columns?: 2 | 3 | 4')
		expect(page).not.toContain('2xl:grid-cols-2')
		expect(page).toContain('<template #workshop>')
		expect(page).toContain('<div :ref="data.levelsTarget">')
		expect(page.indexOf(':ref="data.levelsTarget"')).toBeLessThan(
			page.indexOf('id="profile-popular-levels"'),
		)
		expect(page.indexOf('id="profile-popular-levels"')).toBeLessThan(
			page.indexOf('id="profile-recent-levels"'),
		)
		expect(page.match(/<UserLevelCollection/g)).toHaveLength(2)
	})

	it('links popular levels to default author results and recent levels to latest results', () => {
		expect(page).toContain('const levelsUrl = computed(() => `/levels?author=')
		expect(page).toContain('const recentLevelsUrl = computed(')
		expect(page).toContain('&sort=DATE_CREATED_DESC')
		expect(page).toContain(':action-to="recentLevelsUrl"')
		expect(page).not.toContain('levels?authorName=')
	})
})
