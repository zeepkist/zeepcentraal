import type { RecordsOrderBy } from '~/graphql/generated/graphql'

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

export function recordHistoryOrder(sort: RecordHistorySort): RecordsOrderBy[] {
	if (sort === 'valuable-levels') {
		return ['USER_POINT_CONTRIBUTIONS_MAX_LEVEL_POINTS_DESC', 'DATE_CREATED_DESC', 'ID_DESC']
	}
	if (sort === 'valuable-pbs') {
		return [
			'USER_POINT_CONTRIBUTIONS_MAX_PLAYER_DECAYED_POINTS_DESC',
			'DATE_CREATED_DESC',
			'ID_DESC',
		]
	}
	return ['DATE_CREATED_DESC', 'ID_DESC']
}

export function recordHistoryFilter(
	view: RecordHistoryView,
	sort: RecordHistorySort,
	userId?: number,
) {
	return {
		...(userId ? { userId: { equalTo: userId } } : {}),
		...(view === 'personal-bests' ? { personalBestGlobalsExist: true } : {}),
		...(view === 'world-records' ? { worldRecordGlobalsExist: true } : {}),
		...(sort === 'latest' ? {} : { userPointContributionsExist: true }),
	}
}

export function getNewRecordIds(known: ReadonlySet<number>, next: Iterable<number>) {
	return [...next].filter((recordId) => !known.has(recordId))
}
