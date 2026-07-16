export type LevelPointHistoryPoint = {
	date: string
	points: number
	synthetic?: boolean
}

type HistoryAggregate = {
	keys?: Array<string | null> | null
	max?: { points?: number | null } | null
}

export function getLevelPointsHistoryWindow(now = new Date()) {
	return {
		now: now.toISOString(),
		since: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
	}
}

export function buildLevelPointsHistory(input: {
	baseline?: { dateCreated: unknown; points: number } | null
	groups?: HistoryAggregate[] | null
	currentPoints?: number | null
	createdAt: string
	since: string
	now: string
}): LevelPointHistoryPoint[] {
	const sinceTime = Date.parse(input.since)
	const nowTime = Date.parse(input.now)
	const createdTime = Date.parse(input.createdAt)
	const currentPoints = input.currentPoints
	const points: LevelPointHistoryPoint[] = []

	if (input.baseline && Number.isFinite(sinceTime)) {
		points.push({ date: new Date(sinceTime).toISOString(), points: input.baseline.points })
	}

	for (const group of input.groups ?? []) {
		const date = group.keys?.[0]
		const value = group.max?.points
		const time = date == null ? Number.NaN : Date.parse(date)
		if (value == null || !Number.isFinite(time) || time < sinceTime || time > nowTime) continue
		points.push({ date: new Date(time).toISOString(), points: value })
	}

	points.sort((left, right) => Date.parse(left.date) - Date.parse(right.date))

	if (points.length === 0 && currentPoints != null) {
		const start = Math.max(
			Number.isFinite(createdTime) ? createdTime : sinceTime,
			Number.isFinite(sinceTime) ? sinceTime : createdTime,
		)
		if (Number.isFinite(start) && start < nowTime) {
			points.push({ date: new Date(start).toISOString(), points: currentPoints })
		}
	}

	if (
		currentPoints != null &&
		Number.isFinite(nowTime) &&
		!points.some((point) => point.date === input.now && point.points === currentPoints)
	) {
		points.push({
			date: new Date(nowTime).toISOString(),
			points: currentPoints,
			synthetic: true,
		})
	}

	return points
}
