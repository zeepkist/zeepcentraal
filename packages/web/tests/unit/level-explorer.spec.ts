import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
	buildLevelAvailabilityFilter,
	buildLevelFilter,
	getHotLevelSince,
	getLevelHotWindows,
	HOT_LEVEL_SORTS,
	normalizeLevelRange,
	normalizeViewerLevelFilter,
} from '../../app/utils/levelExplorer'

const levelsQuery = readFileSync(
	new URL('../../app/graphql/queries/levels.graphql', import.meta.url),
	'utf8',
)
const usersQuery = readFileSync(
	new URL('../../app/graphql/queries/users.graphql', import.meta.url),
	'utf8',
)
const composable = readFileSync(
	new URL('../../app/composables/useLevels.ts', import.meta.url),
	'utf8',
)
const levelsPage = readFileSync(new URL('../../app/pages/levels.vue', import.meta.url), 'utf8')
const usersPage = readFileSync(new URL('../../app/pages/users.vue', import.meta.url), 'utf8')

const baseFilter = {
	type: 'all' as const,
	sort: 'DATE_CREATED_DESC' as const,
	search: '',
	author: '',
	points: [0, 9984] as [number, number],
	rating: [0, 100] as [number, number],
	personalBest: 'all' as const,
	worldRecord: 'all' as const,
}

describe('level availability filters', () => {
	it('does not require workshop items for Adventure levels', () => {
		expect(buildLevelAvailabilityFilter('yes')).toEqual({
			adventure: { equalTo: true },
		})
	})

	it('uses persisted visibility when selecting community levels', () => {
		expect(buildLevelAvailabilityFilter('no')).toEqual({
			adventure: { equalTo: false },
		})
	})

	it('uses persisted visibility without an extra availability filter by default', () => {
		expect(buildLevelAvailabilityFilter('all')).toBeUndefined()
	})
})

describe('level explorer filters', () => {
	it('clamps, rounds, and orders URL ranges', () => {
		expect(normalizeLevelRange('-20', '12000', 0, 9984)).toEqual([0, 9984])
		expect(normalizeLevelRange('80.4', '20.2', 0, 100)).toEqual([20, 80])
		expect(normalizeLevelRange(undefined, undefined, 0, 100)).toEqual([0, 100])
	})

	it('normalizes viewer filters', () => {
		expect(normalizeViewerLevelFilter('yes')).toBe('yes')
		expect(normalizeViewerLevelFilter('no')).toBe('no')
		expect(normalizeViewerLevelFilter('invalid')).toBe('all')
	})

	it('omits full ranges and converts rating percentages', () => {
		const unbounded = buildLevelFilter(baseFilter)
		expect(unbounded.and).not.toContainEqual({ levelPointExists: true })

		const bounded = buildLevelFilter({
			...baseFilter,
			points: [100, 500],
			rating: [25, 90],
		})
		expect(bounded.and).toContainEqual({
			levelPoints: {
				points: { greaterThanOrEqualTo: 100, lessThanOrEqualTo: 500 },
				rating: { greaterThanOrEqualTo: 0.25, lessThanOrEqualTo: 0.9 },
			},
		})
		expect(bounded.and).not.toContainEqual({ levelPointExists: true })
	})

	it('builds default points request from persisted visibility only', () => {
		expect(buildLevelFilter({ ...baseFilter, sort: 'LEVEL_POINTS_POINTS_DESC' })).toEqual({
			and: [{ publiclyVisible: { equalTo: true } }],
		})
	})

	it('builds authenticated PB and WR filters without fabricating anonymous filters', () => {
		const included = buildLevelFilter({
			...baseFilter,
			viewerId: 42,
			personalBest: 'yes',
			worldRecord: 'yes',
		})
		expect(included.and).toContainEqual({
			personalBestGlobals: { some: { userId: { equalTo: 42 } } },
		})
		expect(included.and).toContainEqual({
			worldRecordGlobal: { userId: { equalTo: 42 } },
		})

		const excluded = buildLevelFilter({
			...baseFilter,
			viewerId: 42,
			personalBest: 'no',
			worldRecord: 'no',
		})
		expect(excluded.and).toContainEqual({
			personalBestGlobals: { none: { userId: { equalTo: 42 } } },
		})
		expect(excluded.and).toContainEqual({
			or: [
				{ worldRecordGlobalExists: false },
				{ worldRecordGlobal: { userId: { notEqualTo: 42 } } },
			],
		})

		const anonymous = buildLevelFilter({
			...baseFilter,
			personalBest: 'yes',
			worldRecord: 'yes',
		})
		expect(JSON.stringify(anonymous)).not.toContain('personalBestGlobals')
		expect(JSON.stringify(anonymous)).not.toContain('worldRecordGlobal')
	})

	it('filters selected author IDs exactly and keeps text-name fallback', () => {
		const selected = buildLevelFilter({ ...baseFilter, author: '76561198000000000' })
		expect(selected.and).toContainEqual({
			levelItems: { some: { authorId: { equalTo: '76561198000000000' } } },
		})

		const freeform = buildLevelFilter({ ...baseFilter, author: 'Wipeout' })
		expect(freeform.and).toContainEqual({
			levelItems: {
				some: { author: { steamName: { includesInsensitive: 'Wipeout' } } },
			},
		})
	})

	it('freezes exact rolling popularity windows', () => {
		const now = new Date('2026-07-13T12:00:00.000Z')
		const windows = getLevelHotWindows(now)
		expect(windows.todaySince).toBe('2026-07-12T12:00:00.000Z')
		expect(windows.monthSince).toBe('2026-06-13T12:00:00.000Z')
		expect(windows.yearSince).toBe('2025-07-13T12:00:00.000Z')
		expect(getHotLevelSince(HOT_LEVEL_SORTS.today, windows)).toBe(windows.todaySince)
		expect(getHotLevelSince(HOT_LEVEL_SORTS.month, windows)).toBe(windows.monthSince)
		expect(getHotLevelSince(HOT_LEVEL_SORTS.year, windows)).toBe(windows.yearSince)
		expect(buildLevelFilter({ ...baseFilter, sort: HOT_LEVEL_SORTS.today }).and).toContainEqual(
			{ levelPointExists: true },
		)
		expect(
			buildLevelFilter({
				...baseFilter,
				sort: HOT_LEVEL_SORTS.today,
				points: [100, 500],
			}).and,
		).not.toContainEqual({ levelPointExists: true })
	})
})

describe('level explorer requests and layout', () => {
	it('uses bounded cursor pagination and mutually exclusive normal/hot queries', () => {
		expect(composable).toContain('useCursorPagination(24)')
		expect(levelsQuery).toContain('query ZC_Levels(')
		expect(levelsQuery).toContain('query ZC_HotLevels(')
		expect(levelsQuery).toContain('hotLevelsSince(')
		expect(levelsQuery).not.toContain('offset:')
		expect(composable).toContain('pause: hotSort')
		expect(composable).toContain('pause: computed(() => !hotSort.value)')
	})

	it('uses bounded, debounced author suggestions', () => {
		expect(usersQuery).toContain('first: 8')
		expect(usersQuery).toContain('banned: { equalTo: false }')
		expect(usersQuery).toContain('includesInsensitive: $search')
		expect(usersQuery).toContain('orderBy: [STEAM_NAME_ASC]')
		expect(composable).toContain('}, 250)')
		expect(composable).toContain('debouncedAuthor.value.length < 2')
		expect(composable).toContain('value: String(user.steamId)')
	})

	it('renders counts only in filter headers and four explorer columns', () => {
		expect(levelsPage).toContain(':result-count-label=')
		expect(usersPage).toContain(':result-count-label=')
		expect(levelsPage).toContain(':columns="4"')
		expect(levelsPage.match(/levels\.results/g)).toHaveLength(1)
		expect(usersPage.match(/users\.results/g)).toHaveLength(1)
	})
})
