import type { UserCareerHistoryPoint } from '~/types/app'

type HistoryValue = { dateCreated: unknown; points: number; totalPoints: number; rank: number }
type HistoryGroup = {
	keys?: Array<string | null> | null
	max?: { points?: number | null; totalPoints?: number | null } | null
	min?: { rank?: number | null } | null
}

export function getUserCareerHistoryWindow(now = new Date()) {
	return {
		now: now.toISOString(),
		since: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString(),
	}
}

export function buildUserCareerHistory(input: {
	baseline?: HistoryValue | null
	groups?: HistoryGroup[] | null
	current?: { points: number; totalPoints: number; rank: number } | null
	since: string
	now: string
}): UserCareerHistoryPoint[] {
	const points: UserCareerHistoryPoint[] = []
	if (input.baseline) {
		points.push({
			date: input.since,
			rankedPoints: input.baseline.points,
			totalPoints: input.baseline.totalPoints,
			rank: input.baseline.rank > 0 ? input.baseline.rank : null,
		})
	}
	for (const group of input.groups ?? []) {
		const date = group.keys?.[0]
		const rankedPoints = group.max?.points
		const totalPoints = group.max?.totalPoints
		if (
			!date ||
			rankedPoints == null ||
			totalPoints == null ||
			!Number.isFinite(Date.parse(date))
		)
			continue
		const rank = group.min?.rank
		points.push({
			date,
			rankedPoints,
			totalPoints,
			rank: rank != null && rank > 0 ? rank : null,
		})
	}
	points.sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
	if (input.current) {
		points.push({
			date: input.now,
			rankedPoints: input.current.points,
			totalPoints: input.current.totalPoints,
			rank: input.current.rank > 0 ? input.current.rank : null,
		})
	}
	return points
}
