import type { LevelFilter, LevelsOrderBy } from '~/graphql/generated/graphql'

export const LEVEL_POINTS_MIN = 0
export const LEVEL_POINTS_MAX = 9984
export const LEVEL_RATING_MIN = 0
export const LEVEL_RATING_MAX = 100

export const HOT_LEVEL_SORTS = {
	year: 'HOT_YEAR',
	month: 'HOT_MONTH',
	today: 'HOT_TODAY',
} as const

export type HotLevelSort = (typeof HOT_LEVEL_SORTS)[keyof typeof HOT_LEVEL_SORTS]
export type LevelTypeFilter = 'all' | 'yes' | 'no'
export type ViewerLevelFilter = 'all' | 'yes' | 'no'
export type LevelRange = [number, number]

export type LevelHotWindows = {
	yearSince: string
	monthSince: string
	todaySince: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const MONTH_MS = 30 * DAY_MS
const YEAR_MS = 365 * DAY_MS
const pointSorts = new Set<string>([
	'LEVEL_POINTS_MODIFIER_POPULARITY_DESC',
	'LEVEL_POINTS_POINTS_DESC',
	'LEVEL_POINTS_RATING_DESC',
	HOT_LEVEL_SORTS.year,
	HOT_LEVEL_SORTS.month,
	HOT_LEVEL_SORTS.today,
])
const accessibleCommunityFilter: LevelFilter = {
	adventure: { equalTo: false },
	levelItems: { some: { deleted: { equalTo: false } } },
}

export function buildLevelAvailabilityFilter(type: string): LevelFilter {
	if (type === 'yes') return { adventure: { equalTo: true } }
	if (type === 'no') return accessibleCommunityFilter
	return {
		or: [{ adventure: { equalTo: true } }, accessibleCommunityFilter],
	}
}

export function normalizeLevelRange(
	rawMinimum: unknown,
	rawMaximum: unknown,
	minimum: number,
	maximum: number,
): LevelRange {
	const read = (value: unknown, fallback: number) => {
		const candidate = Array.isArray(value) ? value[0] : value
		const parsed =
			typeof candidate === 'string' || typeof candidate === 'number' ? Number(candidate) : NaN
		return Number.isFinite(parsed)
			? Math.min(maximum, Math.max(minimum, Math.round(parsed)))
			: fallback
	}
	const first = read(rawMinimum, minimum)
	const second = read(rawMaximum, maximum)
	return first <= second ? [first, second] : [second, first]
}

export function normalizeViewerLevelFilter(value: unknown): ViewerLevelFilter {
	return value === 'yes' || value === 'no' ? value : 'all'
}

export function getLevelHotWindows(now = new Date()): LevelHotWindows {
	return {
		yearSince: new Date(now.getTime() - YEAR_MS).toISOString(),
		monthSince: new Date(now.getTime() - MONTH_MS).toISOString(),
		todaySince: new Date(now.getTime() - DAY_MS).toISOString(),
	}
}

export function isHotLevelSort(sort: string): sort is HotLevelSort {
	return Object.values(HOT_LEVEL_SORTS).includes(sort as HotLevelSort)
}

export function getHotLevelSince(sort: string, windows: LevelHotWindows): string | undefined {
	if (sort === HOT_LEVEL_SORTS.year) return windows.yearSince
	if (sort === HOT_LEVEL_SORTS.month) return windows.monthSince
	if (sort === HOT_LEVEL_SORTS.today) return windows.todaySince
	return undefined
}

export function buildLevelFilter(input: {
	type: LevelTypeFilter
	sort: LevelsOrderBy | HotLevelSort
	search: string
	author: string
	points: LevelRange
	rating: LevelRange
	personalBest: ViewerLevelFilter
	worldRecord: ViewerLevelFilter
	viewerId?: number
}): LevelFilter {
	const and: LevelFilter[] = [buildLevelAvailabilityFilter(input.type)]
	let requiresLevelPoints = pointSorts.has(input.sort)

	if (input.search) {
		and.push({
			or: [
				{ xxHash: { includesInsensitive: input.search } },
				{ hash: { includesInsensitive: input.search } },
				{ levelItems: { some: { name: { includesInsensitive: input.search } } } },
			],
		})
	}
	if (input.author) {
		const author = input.author.trim()
		and.push({
			levelItems: {
				some: /^\d+$/.test(author)
					? { authorId: { equalTo: author } }
					: { author: { steamName: { includesInsensitive: author } } },
			},
		})
	}

	const levelPoints: NonNullable<LevelFilter['levelPoints']> = {}
	if (input.points[0] !== LEVEL_POINTS_MIN || input.points[1] !== LEVEL_POINTS_MAX) {
		levelPoints.points = {
			greaterThanOrEqualTo: input.points[0],
			lessThanOrEqualTo: input.points[1],
		}
		requiresLevelPoints = true
	}
	if (input.rating[0] !== LEVEL_RATING_MIN || input.rating[1] !== LEVEL_RATING_MAX) {
		levelPoints.rating = {
			greaterThanOrEqualTo: input.rating[0] / 100,
			lessThanOrEqualTo: input.rating[1] / 100,
		}
		requiresLevelPoints = true
	}
	if (Object.keys(levelPoints).length > 0) and.push({ levelPoints })
	if (requiresLevelPoints) and.push({ levelPointExists: true })

	if (input.viewerId && input.personalBest !== 'all') {
		and.push({
			personalBestGlobals: {
				[input.personalBest === 'yes' ? 'some' : 'none']: {
					userId: { equalTo: input.viewerId },
				},
			},
		})
	}
	if (input.viewerId && input.worldRecord === 'yes') {
		and.push({ worldRecordGlobal: { userId: { equalTo: input.viewerId } } })
	}
	if (input.viewerId && input.worldRecord === 'no') {
		and.push({
			or: [
				{ worldRecordGlobalExists: false },
				{ worldRecordGlobal: { userId: { notEqualTo: input.viewerId } } },
			],
		})
	}

	return { and }
}
