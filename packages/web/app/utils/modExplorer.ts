import { MOD_SORTS, type ModSort } from '../types/mod'

export const MOD_PAGE_SIZE = 24
export const GTR_MOD_SLUG = 'zeepkist-gtr'
export const MAX_MOD_TAG_FILTERS = 10

export const MOD_SORT_VALUES: ReadonlySet<string> = new Set(Object.values(MOD_SORTS))

export const MODIO_SORTS: Record<ModSort, string> = {
	[MOD_SORTS.popular]: '-popular',
	[MOD_SORTS.updated]: '-date_updated',
	[MOD_SORTS.newest]: '-date_live',
	[MOD_SORTS.downloadsToday]: '-downloads_today',
	[MOD_SORTS.downloadsTotal]: '-downloads_total',
	[MOD_SORTS.subscribers]: '-subscribers_total',
	[MOD_SORTS.rating]: '-ratings_weighted_aggregate',
	[MOD_SORTS.nameAsc]: 'name',
	[MOD_SORTS.nameDesc]: '-name',
}

export function normalizeModSearch(value: unknown): string {
	return typeof value === 'string' ? value.trim().slice(0, 100) : ''
}

export function normalizeModSort(value: unknown): ModSort {
	return typeof value === 'string' && MOD_SORT_VALUES.has(value)
		? (value as ModSort)
		: MOD_SORTS.popular
}

export function normalizeModPage(value: unknown): number {
	const page = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
	return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export function normalizeEssentialsOnly(value: unknown): boolean {
	return value === true || value === '1' || value === 'true'
}

export function normalizeModTags(value: unknown): string[] {
	const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
	const tags = values
		.flatMap((tag) => (typeof tag === 'string' ? [tag.trim()] : []))
		.filter((tag) => tag.length > 0 && tag.length <= 50)
		.filter((tag) => !['plugin', 'dependency', 'essentials'].includes(tag.toLowerCase()))

	const unique = new Map<string, string>()
	for (const tag of tags) {
		const key = tag.toLowerCase()
		if (!unique.has(key)) unique.set(key, tag)
	}
	return [...unique.values()].slice(0, MAX_MOD_TAG_FILTERS)
}

export function normalizeModSlug(value: unknown): string | null {
	if (typeof value !== 'string') return null
	const slug = value.trim().toLowerCase()
	return slug.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null
}

export function getModPageWindow(page: number, pinnedResult: boolean) {
	if (!pinnedResult) return { limit: MOD_PAGE_SIZE, offset: (page - 1) * MOD_PAGE_SIZE }
	if (page === 1) return { limit: MOD_PAGE_SIZE - 1, offset: 0 }
	return { limit: MOD_PAGE_SIZE, offset: MOD_PAGE_SIZE - 1 + (page - 2) * MOD_PAGE_SIZE }
}

const HIDDEN_MOD_TAGS = new Set(['plugin', 'dependency', 'humor'])

export function isEssentialsModTag(tag: string): boolean {
	return tag.trim().toLowerCase() === 'essentials'
}

export function getVisibleModTags(tags: string[], limit = 2): string[] {
	return tags
		.filter((tag) => !HIDDEN_MOD_TAGS.has(tag.trim().toLowerCase()) && !isEssentialsModTag(tag))
		.slice(0, limit)
}
