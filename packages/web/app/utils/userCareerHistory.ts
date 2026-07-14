import type { UserCareerHistoryPoint, UserCareerSecondaryHistoryPoint } from '~/types/app'

type HistoryValue = {
	dateCreated: unknown
	points: number
	rank: number
}
type HistoryGroup = {
	keys?: Array<string | null> | null
	max?: {
		points?: number | null
	} | null
	min?: { rank?: number | null } | null
}

type SecondaryHistoryValue = {
	dateCreated: unknown
	totalPoints: number
	worldRecords: number
}

type SecondaryHistoryGroup = {
	keys?: Array<string | null> | null
	max?: {
		totalPoints?: number | null
		worldRecords?: number | null
	} | null
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
	current?: { points: number; rank: number } | null
	since: string
	now: string
}): UserCareerHistoryPoint[] {
	const points: UserCareerHistoryPoint[] = []
	if (input.baseline) {
		points.push({
			date: input.since,
			rankedPoints: input.baseline.points,
			rank: input.baseline.rank > 0 ? input.baseline.rank : null,
		})
	}
	for (const group of input.groups ?? []) {
		const date = group.keys?.[0]
		const rankedPoints = group.max?.points
		if (!date || rankedPoints == null || !Number.isFinite(Date.parse(date))) continue
		const rank = group.min?.rank
		points.push({
			date,
			rankedPoints,
			rank: rank != null && rank > 0 ? rank : null,
		})
	}
	points.sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
	if (input.current) {
		points.push({
			date: input.now,
			rankedPoints: input.current.points,
			rank: input.current.rank > 0 ? input.current.rank : null,
		})
	}
	return points
}

export function buildUserCareerSecondaryHistory(input: {
	baseline?: SecondaryHistoryValue | null
	groups?: SecondaryHistoryGroup[] | null
	current?: { totalPoints: number; worldRecords: number } | null
	since: string
	now: string
}): UserCareerSecondaryHistoryPoint[] {
	const points: UserCareerSecondaryHistoryPoint[] = []
	if (input.baseline) {
		points.push({
			date: input.since,
			totalPoints: input.baseline.totalPoints,
			worldRecords: input.baseline.worldRecords,
		})
	}
	for (const group of input.groups ?? []) {
		const date = group.keys?.[0]
		const totalPoints = group.max?.totalPoints
		const worldRecords = group.max?.worldRecords
		if (
			!date ||
			totalPoints == null ||
			worldRecords == null ||
			!Number.isFinite(Date.parse(date))
		)
			continue
		points.push({ date, totalPoints, worldRecords })
	}
	points.sort((left, right) => Date.parse(left.date) - Date.parse(right.date))
	if (input.current) {
		points.push({
			date: input.now,
			totalPoints: input.current.totalPoints,
			worldRecords: input.current.worldRecords,
		})
	}
	return points
}

export function createUserCareerAxisFormatter(locale: string) {
	return new Intl.NumberFormat(locale, {
		notation: 'compact',
		compactDisplay: 'short',
		maximumFractionDigits: 2,
	})
}
