import type {
	LobbyListingFilter,
	LobbyListingsOrderBy,
	LobbyStatFilter,
	LobbyStatGroupBy,
	Zc_LobbyRoomFragment,
} from '@zeepkist/graphql/generated'

export const LOBBY_STALE_MS = 120_000
export const LOBBY_GAP_MS = 300_000
export const LOBBY_RANGES = ['24h', '7d', '30d', '90d', '1y', 'all'] as const
export type LobbyRange = (typeof LOBBY_RANGES)[number]
export const LOBBY_SORTS = [
	'players',
	'occupancy',
	'peak',
	'age',
	'name',
	'closed',
	'first',
	'last',
	'duration',
] as const
export type LobbySort = (typeof LOBBY_SORTS)[number]
export type LobbyRoom = Omit<
	Zc_LobbyRoomFragment,
	| 'id'
	| 'hostId'
	| 'firstSeen'
	| 'lastSeen'
	| 'peakTime'
	| 'closedAt'
	| 'durationSeconds'
	| 'occupancy'
	| 'host'
> & {
	id: string
	hostId: string
	firstSeen: string
	lastSeen: string
	peakTime: string | null
	closedAt: string | null
	durationSeconds: number
	occupancy: number | null
	host: { steamId: string; steamName?: string | null } | null
}
export function mapLobbyRoom(room: Zc_LobbyRoomFragment): LobbyRoom {
	return {
		...room,
		id: String(room.id),
		hostId: String(room.hostId),
		firstSeen: String(room.firstSeen),
		lastSeen: String(room.lastSeen),
		peakTime: room.peakTime == null ? null : String(room.peakTime),
		closedAt: room.closedAt == null ? null : String(room.closedAt),
		durationSeconds: Number(room.durationSeconds ?? 0),
		occupancy: lobbyNumber(room.occupancy),
		host: room.host
			? { steamId: String(room.host.steamId), steamName: room.host.steamName }
			: null,
	}
}
export function lobbyNumber(value: unknown): number | null {
	return value == null || !Number.isFinite(Number(value)) ? null : Number(value)
}
export type LobbyChartPoint = { time: number; [key: string]: number | null }
export function withLobbyChartGaps(points: LobbyChartPoint[], interval: number): LobbyChartPoint[] {
	const ordered = points
		.filter((point) => Number.isFinite(point.time))
		.toSorted((a, b) => a.time - b.time)
	return ordered.flatMap((point, index) => {
		const previous = ordered[index - 1]
		if (!previous || point.time - previous.time <= interval * 1.5) return [point]
		const gap: LobbyChartPoint = { time: previous.time + interval }
		for (const key of Object.keys(point)) if (key !== 'time') gap[key] = null
		return [gap, point]
	})
}
export function mapLobbyPage(
	page:
		| {
				startCursor?: unknown
				endCursor?: unknown
				hasNextPage: boolean
				hasPreviousPage: boolean
		  }
		| null
		| undefined,
) {
	return {
		startCursor: page?.startCursor == null ? null : String(page.startCursor),
		endCursor: page?.endCursor == null ? null : String(page.endCursor),
		hasNextPage: page?.hasNextPage ?? false,
		hasPreviousPage: page?.hasPreviousPage ?? false,
	}
}
export const rangeDuration = (range: LobbyRange) =>
	({
		'24h': 86_400_000,
		'7d': 604_800_000,
		'30d': 2_592_000_000,
		'90d': 7_776_000_000,
		'1y': 31_536_000_000,
		all: 0,
	})[range]
export function normalizeLobbyRange(value: unknown): LobbyRange {
	return LOBBY_RANGES.includes(value as LobbyRange) ? (value as LobbyRange) : '24h'
}
export function lobbyGrouping(range: LobbyRange): LobbyStatGroupBy {
	return (
		{
			'24h': 'DATE_CREATED_TRUNCATED_TO_FIVE_MINUTES',
			'7d': 'DATE_CREATED_TRUNCATED_TO_UTC_HOUR',
			'30d': 'DATE_CREATED_TRUNCATED_TO_SIX_HOURS',
			'90d': 'DATE_CREATED_TRUNCATED_TO_UTC_DAY',
			'1y': 'DATE_CREATED_TRUNCATED_TO_UTC_DAY',
			all: 'DATE_CREATED_TRUNCATED_TO_MONTH',
		} as const
	)[range]
}
export function lobbyStatisticsFilters(range: LobbyRange, peak: string, now: number) {
	const duration = rangeDuration(range)
	const filter: LobbyStatFilter = duration
		? {
				dateCreated: { greaterThanOrEqualTo: new Date(now - duration).toISOString() },
			}
		: { id: { greaterThan: '0' } }
	const previousFilter: LobbyStatFilter = duration
		? {
				dateCreated: {
					greaterThanOrEqualTo: new Date(now - (duration || 1) * 2).toISOString(),
					lessThan: new Date(now - (duration || 1)).toISOString(),
				},
			}
		: { id: { equalTo: '0' } }
	const peakStart =
		peak === 'today'
			? new Date(now).setUTCHours(0, 0, 0, 0)
			: now - ({ '7d': 7, '30d': 30, '90d': 90 }[peak] ?? 0) * 86_400_000
	const peakFilter: LobbyStatFilter =
		peak === 'all'
			? { id: { greaterThan: '0' } }
			: {
					dateCreated: {
						greaterThanOrEqualTo: new Date(peakStart).toISOString(),
					},
				}
	return { filter, previousFilter, peakFilter, groupBy: [lobbyGrouping(range)] }
}
export function lobbyOrderBy(sort: string): LobbyListingsOrderBy[] {
	const primary =
		(
			{
				players: 'PLAYERS_DESC',
				occupancy: 'OCCUPANCY_DESC',
				peak: 'PEAK_PLAYERS_DESC',
				age: 'FIRST_SEEN_ASC',
				name: 'ROOM_NAME_ASC',
				closed: 'CLOSED_AT_DESC',
				first: 'FIRST_SEEN_DESC',
				last: 'LAST_SEEN_DESC',
				duration: 'DURATION_SECONDS_DESC',
			} as Record<string, LobbyListingsOrderBy>
		)[sort] ?? 'PLAYERS_DESC'
	return [primary, 'ID_DESC']
}
export function buildLobbyFilter(
	query: Record<string, unknown>,
	history: boolean,
): LobbyListingFilter {
	const and: LobbyListingFilter[] = []
	if (!history) and.push({ closedAt: { isNull: true } })
	else if (query.active !== '1') and.push({ closedAt: { isNull: false } })
	if (typeof query.q === 'string' && query.q.trim())
		and.push({ roomName: { includesInsensitive: query.q.trim() } })
	if (
		typeof query.host === 'string' &&
		/^\d{1,19}$/.test(query.host) &&
		BigInt(query.host) <= 9223372036854775807n
	)
		and.push({ hostId: { equalTo: query.host } })
	if (query.visibility === 'public' || query.visibility === 'private')
		and.push({ isPublic: { equalTo: query.visibility === 'public' } })
	if (query.capacity === '1') and.push({ availableCapacity: { equalTo: true } })
	if (query.populated === '1') and.push({ players: { greaterThan: 0 } })
	for (const [key, field] of [
		['minPeak', 'greaterThanOrEqualTo'],
		['maxPeak', 'lessThanOrEqualTo'],
	] as const) {
		if (
			typeof query[key] === 'string' &&
			/^\d{1,10}$/.test(query[key]) &&
			Number(query[key]) <= 2147483647
		)
			and.push({ peakPlayers: { [field]: Number(query[key]) } })
	}
	if (typeof query.duration === 'string' && /^\d{1,10}$/.test(query.duration))
		and.push({ durationSeconds: { greaterThanOrEqualTo: Number(query.duration) * 60 } })
	const date = (value: unknown) =>
		typeof value === 'string' &&
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		Number.isFinite(Date.parse(value)) &&
		new Date(value).toISOString().slice(0, 10) === value
			? Date.parse(value)
			: null
	const from = date(query.from),
		to = date(query.to)
	if (from !== null && to !== null && from > to)
		return { and: [{ id: { lessThan: '0' } }, { id: { greaterThan: '0' } }] }
	if (from !== null)
		and.push({
			or: [
				{ closedAt: { greaterThanOrEqualTo: new Date(from).toISOString() } },
				{
					and: [
						{ closedAt: { isNull: true } },
						{ lastSeen: { greaterThanOrEqualTo: new Date(from).toISOString() } },
					],
				},
			],
		})
	if (to !== null) and.push({ firstSeen: { lessThan: new Date(to + 86_400_000).toISOString() } })
	return { and: and.length ? and : [{ id: { greaterThan: '0' } }] }
}
export function lobbyRatio(numerator: unknown, denominator: unknown) {
	const value = lobbyNumber(numerator),
		total = lobbyNumber(denominator)
	return value !== null && total !== null && total > 0 ? value / total : null
}
export function hasLobbyPeriodCoverage(start: number, end: number, first: unknown, last: unknown) {
	const from = typeof first === 'string' ? Date.parse(first) : NaN
	const to = typeof last === 'string' ? Date.parse(last) : NaN
	return from <= start + LOBBY_GAP_MS && to >= end - LOBBY_GAP_MS
}
export function lobbyChange(current: unknown, previous: unknown) {
	const value = lobbyNumber(current),
		before = lobbyNumber(previous)
	return value != null && before != null && before !== 0 ? (value - before) / before : null
}
export function lobbyDuration(start: string, end: string | null | undefined, now: number) {
	const seconds = Math.max(
		0,
		Math.floor(((end ? Date.parse(end) : now) - Date.parse(start)) / 1000),
	)
	return {
		days: Math.floor(seconds / 86400),
		hours: Math.floor((seconds % 86400) / 3600),
		minutes: Math.floor((seconds % 3600) / 60),
	}
}
