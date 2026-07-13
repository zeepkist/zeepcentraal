export type LevelSplitSeries = {
	key: string
	recordId: number
	userName: string
	userSteamId?: string | null
	time: number
	color: string
	viewer: boolean
	viewerComparison: boolean
	deltas: number[]
	speeds: number[]
}

export type LevelSplitAnalysis = {
	checkpointCount: number
	series: LevelSplitSeries[]
	deltaData: Array<Record<string, number>>
	speedData: Array<Record<string, number>>
}

type RawSplitRecord = {
	id: number
	time: number
	splits?: Array<number | null> | null
	speeds?: Array<number | null> | null
	user?: { steamId: unknown; steamName?: string | null } | null
}

const SERIES_COLORS = ['#facc15', '#38bdf8', '#22c55e', '#f43f5e', '#a78bfa', '#fb923c'] as const

function numericArray(value?: Array<number | null> | null): number[] | null {
	if (!value?.length || value.some((item) => item == null || !Number.isFinite(item))) return null
	return value as number[]
}

export function buildLevelSplitAnalysis(
	records: RawSplitRecord[],
	viewerRecord?: RawSplitRecord | null,
): LevelSplitAnalysis {
	const viewerAppended = Boolean(
		viewerRecord && !records.some((record) => record.id === viewerRecord.id),
	)
	const combinedRecords = viewerAppended && viewerRecord ? [...records, viewerRecord] : records
	const normalized = combinedRecords.flatMap((record) => {
		const splits = numericArray(record.splits)
		const speeds = numericArray(record.speeds)
		return splits && speeds && splits.length === speeds.length
			? [{ record, splits, speeds }]
			: []
	})
	const fastest = normalized[0]
	if (!fastest) return { checkpointCount: 0, series: [], deltaData: [], speedData: [] }

	const compatible = normalized.filter(
		(item) =>
			item.splits.length === fastest.splits.length &&
			item.speeds.length === fastest.speeds.length,
	)
	const series = compatible.map(
		({ record, splits, speeds }, index): LevelSplitSeries => ({
			key: `record_${record.id}`,
			recordId: record.id,
			userName: record.user?.steamName ?? String(record.user?.steamId ?? record.id),
			userSteamId: record.user?.steamId == null ? null : String(record.user.steamId),
			time: record.time,
			color: SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0],
			viewer: record.id === viewerRecord?.id,
			viewerComparison: viewerAppended && record.id === viewerRecord?.id,
			deltas: splits.map(
				(split, checkpoint) => split - (fastest.splits[checkpoint] ?? split),
			),
			speeds,
		}),
	)
	const data = (field: 'deltas' | 'speeds') =>
		Array.from({ length: fastest.splits.length }, (_, checkpoint) => ({
			checkpoint: checkpoint + 1,
			...Object.fromEntries(series.map((item) => [item.key, item[field][checkpoint] ?? 0])),
		}))

	return {
		checkpointCount: fastest.splits.length,
		series,
		deltaData: data('deltas'),
		speedData: data('speeds'),
	}
}
