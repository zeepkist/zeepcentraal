import type { RecordHistoryEntriesOrderBy } from '~/graphql/generated/graphql'
import type { RecordResultStatus } from '~/types/app'

export const recordHistoryViews = ['recent', 'personal-bests', 'world-records'] as const
export const recordHistorySorts = ['latest', 'valuable-levels', 'valuable-pbs'] as const

export type RecordHistoryView = (typeof recordHistoryViews)[number]
export type RecordHistorySort = (typeof recordHistorySorts)[number]

export function normalizeRecordHistoryView(value: unknown): RecordHistoryView {
	return typeof value === 'string' && (recordHistoryViews as readonly string[]).includes(value)
		? (value as RecordHistoryView)
		: 'recent'
}

export function normalizeRecordHistorySort(value: unknown): RecordHistorySort {
	return typeof value === 'string' && (recordHistorySorts as readonly string[]).includes(value)
		? (value as RecordHistorySort)
		: 'latest'
}

export function recordHistoryOrder(sort: RecordHistorySort): RecordHistoryEntriesOrderBy[] {
	if (sort === 'valuable-levels') {
		return ['LEVEL_POINTS_DESC', 'DATE_CREATED_DESC', 'ID_DESC']
	}
	if (sort === 'valuable-pbs') {
		return ['PLAYER_DECAYED_POINTS_DESC', 'DATE_CREATED_DESC', 'ID_DESC']
	}
	return ['DATE_CREATED_DESC', 'ID_DESC']
}

export function recordHistoryFilter(
	view: RecordHistoryView,
	sort: RecordHistorySort,
	userId?: number,
) {
	const filter = {
		historyView: { equalTo: view },
		...(userId ? { userId: { equalTo: userId } } : {}),
		...(sort === 'latest' ? {} : { hasContribution: { equalTo: true } }),
	}
	return filter
}

export function getNewRecordIds(known: ReadonlySet<number>, next: Iterable<number>) {
	return [...next].filter((recordId) => !known.has(recordId))
}

export function getRecordResultStatus(
	personalBestCount: number,
	worldRecordCount: number,
): RecordResultStatus | null {
	if (worldRecordCount > 0) return 'world-record'
	if (personalBestCount > 0) return 'personal-best'
	return null
}
