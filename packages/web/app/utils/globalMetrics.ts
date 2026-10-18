import type { Zc_GlobalMetricsFragment } from '@zeepkist/graphql/generated'

type MetricCounts = Omit<
	Zc_GlobalMetricsFragment,
	'__typename' | 'asOf' | 'dayStart' | 'monthStart' | 'timeZone'
>
export type GlobalMetrics = { [K in keyof MetricCounts]: bigint } & {
	asOf: string
	dayStart: string
	monthStart: string
	timeZone: string
}

function count(value: unknown): bigint {
	if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
		throw new Error('Global metric missing')
	}
	return BigInt(value)
}

export function normalizeGlobalMetrics(value: Zc_GlobalMetricsFragment): GlobalMetrics {
	return {
		records: count(value.records),
		recordsToday: count(value.recordsToday),
		recordsMonth: count(value.recordsMonth),
		personalBests: count(value.personalBests),
		personalBestsToday: count(value.personalBestsToday),
		personalBestsMonth: count(value.personalBestsMonth),
		worldRecords: count(value.worldRecords),
		worldRecordsToday: count(value.worldRecordsToday),
		worldRecordsMonth: count(value.worldRecordsMonth),
		levels: count(value.levels),
		levelsToday: count(value.levelsToday),
		levelsMonth: count(value.levelsMonth),
		votes: count(value.votes),
		votesToday: count(value.votesToday),
		votesMonth: count(value.votesMonth),
		players: count(value.players),
		playersAll: count(value.playersAll),
		rankedPlayers: count(value.rankedPlayers),
		activePlayersToday: count(value.activePlayersToday),
		activePlayersMonth: count(value.activePlayersMonth),
		asOf: String(value.asOf),
		dayStart: String(value.dayStart),
		monthStart: String(value.monthStart),
		timeZone: String(value.timeZone),
	}
}
