export const MOD_SORTS = {
	popular: 'popular',
	updated: 'updated',
	newest: 'newest',
	downloadsToday: 'downloads-today',
	downloadsTotal: 'downloads-total',
	subscribers: 'subscribers',
	rating: 'rating',
	nameAsc: 'name-asc',
	nameDesc: 'name-desc',
} as const

export type ModSort = (typeof MOD_SORTS)[keyof typeof MOD_SORTS]

export type ModSummary = {
	id: number
	slug: string
	name: string
	summary: string
	authorName: string
	authorUrl: string | null
	imageUrl: string | null
	profileUrl: string
	version: string | null
	fileSize: number | null
	dateUpdated: string
	dateLive: string
	tags: string[]
	downloads: number
	subscribers: number
	rating: number | null
}

export type ModDetail = ModSummary & {
	descriptionHtml: string
}

export type ModListResponse = {
	items: ModSummary[]
	page: number
	pageSize: number
	total: number
	totalPages: number
}

export type ModDetailResponse = {
	mod: ModDetail
	dependencies: ModSummary[]
}

export type ModTagOptionsResponse = {
	tags: string[]
}
