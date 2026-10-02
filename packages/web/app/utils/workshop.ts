import type {
	WorkshopItemFilter,
	WorkshopItemsOrderBy,
	Zc_WorkshopCardFragment,
} from '@zeepkist/graphql/generated'
import type { CursorPage, WorkshopSummary } from '~/types/app'

export const WORKSHOP_SORTS = {
	latest: 'CREATED_AT_DESC',
	updated: 'UPDATED_AT_DESC',
	name: 'NAME_ASC',
} as const

export type WorkshopSort = (typeof WORKSHOP_SORTS)[keyof typeof WORKSHOP_SORTS]

export function normalizeWorkshopSort(value: unknown): WorkshopSort {
	return Object.values(WORKSHOP_SORTS).includes(value as WorkshopSort)
		? (value as WorkshopSort)
		: WORKSHOP_SORTS.latest
}

export function workshopOrderBy(sort: WorkshopSort): WorkshopItemsOrderBy[] {
	return [sort, 'WORKSHOP_ID_DESC']
}

export function isWorkshopId(value: string): boolean {
	return /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
}

export function buildWorkshopFilter(input: {
	search?: string
	author?: string
	levelId?: number
}): WorkshopItemFilter | undefined {
	const and: WorkshopItemFilter[] = []
	const search = input.search?.trim()
	const author = input.author?.trim()
	if (search) and.push({ name: { includesInsensitive: search } })
	if (author) {
		and.push(
			/^\d+$/.test(author)
				? { authorId: { equalTo: author } }
				: { author: { steamName: { includesInsensitive: author } } },
		)
	}
	if (input.levelId !== undefined) {
		and.push({
			levelItems: {
				some: { levelId: { equalTo: input.levelId }, deleted: { equalTo: false } },
			},
		})
	}
	return and.length ? { and } : undefined
}

export function mapWorkshopSummary(node: Zc_WorkshopCardFragment): WorkshopSummary {
	return {
		workshopId: String(node.workshopId),
		name: node.name,
		imageUrl: node.imageUrl || null,
		authorSteamId: String(node.authorId),
		authorName: node.author?.steamName ?? null,
		createdAt: String(node.createdAt),
		updatedAt: String(node.updatedAt),
		fileSize: node.fileSize,
	}
}

export function mapWorkshopPage(page?: {
	startCursor?: unknown
	endCursor?: unknown
	hasNextPage: boolean
	hasPreviousPage: boolean
}): CursorPage {
	return {
		startCursor: page?.startCursor == null ? null : String(page.startCursor),
		endCursor: page?.endCursor == null ? null : String(page.endCursor),
		hasNextPage: page?.hasNextPage ?? false,
		hasPreviousPage: page?.hasPreviousPage ?? false,
	}
}

export function formatWorkshopFileSize(bytes: number, locale: string): string {
	const units = ['B', 'KiB', 'MiB', 'GiB'] as const
	const index = bytes > 0 ? Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024))) : 0
	const value = Math.max(0, bytes) / 1024 ** index
	return `${new Intl.NumberFormat(locale, { maximumFractionDigits: index ? 1 : 0 }).format(value)} ${units[index]}`
}
