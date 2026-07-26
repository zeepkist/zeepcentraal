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
	readonly id: number
	readonly slug: string
	readonly name: string
	readonly summary: string
	readonly authorName: string
	readonly authorUrl: string | null
	readonly imageUrl: string | null
	readonly profileUrl: string
	readonly version: string | null
	readonly fileSize: number | null
	readonly dateUpdated: string
	readonly dateLive: string
	readonly tags: readonly string[]
	readonly downloads: number
	readonly subscribers: number
	readonly rating: number | null
}

export type ModDetail = ModSummary & {
	readonly descriptionHtml: string
}

export type ModListResponse = {
	readonly items: readonly ModSummary[]
	readonly page: number
	readonly pageSize: number
	readonly total: number
	readonly totalPages: number
}

export type ModDetailResponse = {
	readonly mod: ModDetail
	readonly dependencies: readonly ModSummary[]
}

export type ModTagOptionsResponse = {
	readonly tags: readonly string[]
}
