export type RecordHistoryColumn =
	| 'level'
	| 'player'
	| 'rank'
	| 'time'
	| 'delta'
	| 'status'
	| 'points'
	| 'rankedPoints'
	| 'date'

export type RecordHistoryColumnOptions = {
	showLevel?: boolean
	showPlayer?: boolean
	rankFirst?: boolean
	showStatus?: boolean
	showDelta?: boolean
}

export function getRecordHistoryColumns({
	showLevel = true,
	showPlayer = false,
	rankFirst = false,
	showStatus = false,
	showDelta = false,
}: RecordHistoryColumnOptions = {}): RecordHistoryColumn[] {
	const entityColumns: RecordHistoryColumn[] = []
	if (showLevel) entityColumns.push('level')
	if (showPlayer) entityColumns.push('player')

	return [
		...(rankFirst ? (['rank'] as const) : []),
		...entityColumns,
		...(showStatus ? (['status'] as const) : []),
		...(!rankFirst ? (['rank'] as const) : []),
		'time',
		...(showDelta ? (['delta'] as const) : []),
		'points',
		'rankedPoints',
		'date',
	]
}
