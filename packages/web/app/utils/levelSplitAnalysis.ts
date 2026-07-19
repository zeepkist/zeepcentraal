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
	speeds: Array<number | null>
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
	color?: string | null
	splits?: Array<number | null> | null
	speeds?: Array<number | null> | null
	finishSpeed?: number | null
	user?: { steamId: unknown; steamName?: string | null } | null
}

const SERIES_COLORS = ['#facc15', '#38bdf8', '#22c55e', '#f43f5e', '#a78bfa', '#fb923c'] as const

function numericArray(value?: Array<number | null> | null): number[] | null {
	if (!value || value.some((item) => item == null || !Number.isFinite(item))) return null
	return value as number[]
}

function finiteOrNull(value: number | null | undefined): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function resolveGhostFinishSpeed(frames: ReadonlyArray<{ speed?: number }>): number | null {
	return finiteOrNull(frames.at(-1)?.speed)
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
		return splits ? [{ record, splits }] : []
	})
	const fastest = normalized[0]
	if (!fastest) return { checkpointCount: 0, series: [], deltaData: [], speedData: [] }

	const checkpointCount = fastest.splits.length
	const compatible = normalized.filter((item) => item.splits.length === checkpointCount)
	const series = compatible.map(({ record, splits }, index): LevelSplitSeries => {
		const checkpointSpeeds = numericArray(record.speeds)
		const speeds =
			checkpointSpeeds?.length === checkpointCount
				? checkpointSpeeds
				: Array<number | null>(checkpointCount).fill(null)

		return {
			key: `record_${record.id}`,
			recordId: record.id,
			userName: record.user?.steamName ?? String(record.user?.steamId ?? record.id),
			userSteamId: record.user?.steamId == null ? null : String(record.user.steamId),
			time: record.time,
			color: record.color ?? SERIES_COLORS[index % SERIES_COLORS.length] ?? SERIES_COLORS[0],
			viewer: record.id === viewerRecord?.id,
			viewerComparison: viewerAppended && record.id === viewerRecord?.id,
			deltas: [...splits, record.time].map((split, checkpoint) => {
				const fastestTime =
					checkpoint === checkpointCount
						? fastest.record.time
						: (fastest.splits[checkpoint] ?? split)
				return split - fastestTime
			}),
			speeds: [...speeds, finiteOrNull(record.finishSpeed)],
		}
	})
	const data = (field: 'deltas' | 'speeds', length: number) =>
		Array.from({ length }, (_, checkpoint) => ({
			checkpoint: checkpoint + 1,
			...Object.fromEntries(
				series.flatMap((item) => {
					const value = item[field][checkpoint]
					return typeof value === 'number' ? [[item.key, value]] : []
				}),
			),
		}))
	const hasFinishSpeed = series.some((item) => item.speeds[checkpointCount] != null)

	return {
		checkpointCount,
		series,
		deltaData: data('deltas', checkpointCount + 1),
		speedData: data('speeds', checkpointCount + (hasFinishSpeed ? 1 : 0)),
	}
}
