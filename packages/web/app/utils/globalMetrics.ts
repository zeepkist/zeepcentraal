import type { Zc_GlobalMetricsFragment } from '@zeepkist/graphql/generated'

type MetricCounts = Omit<
	Zc_GlobalMetricsFragment,
	| '__typename'
	| 'asOf'
	| 'dayStart'
	| 'monthStart'
	| 'timeZone'
	| 'yesterdayStart'
	| 'lastMonthStart'
>
export type GlobalMetrics = { [K in keyof MetricCounts]: bigint } & {
	asOf: string
	dayStart: string
	monthStart: string
	timeZone: string
	yesterdayStart: string
	lastMonthStart: string
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
		rankedPlayers: count(value.rankedPlayers),
		activePlayersToday: count(value.activePlayersToday),
		activePlayersMonth: count(value.activePlayersMonth),
		recordsYesterday: count(value.recordsYesterday),
		recordsLastMonth: count(value.recordsLastMonth),
		personalBestsYesterday: count(value.personalBestsYesterday),
		personalBestsLastMonth: count(value.personalBestsLastMonth),
		worldRecordsYesterday: count(value.worldRecordsYesterday),
		worldRecordsLastMonth: count(value.worldRecordsLastMonth),
		levelsYesterday: count(value.levelsYesterday),
		levelsLastMonth: count(value.levelsLastMonth),
		votesYesterday: count(value.votesYesterday),
		votesLastMonth: count(value.votesLastMonth),
		activePlayersYesterday: count(value.activePlayersYesterday),
		activePlayersLastMonth: count(value.activePlayersLastMonth),
		yesterdayStart: String(value.yesterdayStart),
		lastMonthStart: String(value.lastMonthStart),
		asOf: String(value.asOf),
		dayStart: String(value.dayStart),
		monthStart: String(value.monthStart),
		timeZone: String(value.timeZone),
	}
}
