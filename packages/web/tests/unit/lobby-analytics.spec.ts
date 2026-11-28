import { describe, expect, it } from 'vitest'
import {
	buildLobbyFilter,
	hasLobbyPeriodCoverage,
	lobbyChange,
	lobbyDuration,
	lobbyGrouping,
	lobbyNumber,
	lobbyObservationIsStale,
	lobbyOrderBy,
	lobbyRatio,
	lobbyRoundLength,
	lobbyStatisticsFilters,
	mapLobbyPage,
	normalizeLobbyRange,
	withLobbyChartGaps,
} from '../../app/utils/lobbyAnalytics'

describe('lobby analytics semantics', () => {
	it('formats configured round lengths without displaying unknown time as zero', () => {
		expect(lobbyRoundLength(60, 'en')).toBe('1m')
		expect(lobbyRoundLength(360, 'en')).toBe('6m')
		expect(lobbyRoundLength(89.5, 'en')).toBe('1m 30s')
		expect(lobbyRoundLength(3661, 'en')).toBe('1h 1m 1s')
		for (const value of [0, null, undefined, Number.NaN, -1]) {
			expect(lobbyRoundLength(value, 'en')).toBeNull()
		}
	})
	it('warns only beyond one hour with a valid observation timestamp', () => {
		const observed = '2026-11-10T20:00:00Z'
		const now = Date.parse(observed)
		expect(lobbyObservationIsStale(observed, now + 3_600_000)).toBe(false)
		expect(lobbyObservationIsStale(observed, now + 3_600_001)).toBe(true)
		for (const value of [undefined, null, '', 'invalid']) {
			expect(lobbyObservationIsStale(value, now)).toBe(false)
		}
		expect(lobbyObservationIsStale(observed, now - 1)).toBe(false)
	})
	it('defaults history to public rooms while preserving explicit all/private visibility', () => {
		expect(buildLobbyFilter({}, true).and).toContainEqual({ isPublic: { equalTo: true } })
		expect(
			buildLobbyFilter({ visibility: 'private', after: 'cursor' }, true).and,
		).toContainEqual({ isPublic: { equalTo: false } })
		expect(buildLobbyFilter({ visibility: 'all' }, true).and).not.toContainEqual({
			isPublic: { equalTo: true },
		})
		expect(buildLobbyFilter({}, false).and).not.toContainEqual({ isPublic: { equalTo: true } })
	})
	it('leaves gaps instead of zeroes and suppresses comparisons without boundary observations', () => {
		expect(
			withLobbyChartGaps(
				[
					{ time: 0, players: 12 },
					{ time: 3600000, players: 8 },
				],
				300000,
			),
		).toEqual([
			{ time: 0, players: 12 },
			{ time: 300000, players: null },
			{ time: 3600000, players: 8 },
		])
		expect(hasLobbyPeriodCoverage(0, 3600000, '1970-01-01T00:01Z', '1970-01-01T00:59Z')).toBe(
			true,
		)
		expect(hasLobbyPeriodCoverage(0, 3600000, '1970-01-01T00:30Z', '1970-01-01T00:59Z')).toBe(
			false,
		)
		expect(hasLobbyPeriodCoverage(0, 3600000, null, null)).toBe(false)
	})
	it('uses the same filters for server-side pagination, private rooms, and overlapping lifetimes', () => {
		const filter = buildLobbyFilter(
			{
				from: '2001-01-02',
				to: '2001-01-02',
				active: '1',
				visibility: 'private',
				q: 'Night',
				minPeak: '2',
				duration: '60',
			},
			true,
		)
		expect(filter.and).toContainEqual({ roomName: { includesInsensitive: 'Night' } })
		expect(filter.and).toContainEqual({ isPublic: { equalTo: false } })
		expect(filter.and).not.toContainEqual({ closedAt: { isNull: false } })
		expect(filter.and).toContainEqual({ firstSeen: { lessThan: '2001-01-03T00:00:00.000Z' } })
		expect(filter.and).toContainEqual({
			or: [
				{ closedAt: { greaterThanOrEqualTo: '2001-01-02T00:00:00.000Z' } },
				{
					and: [
						{ closedAt: { isNull: true } },
						{ lastSeen: { greaterThanOrEqualTo: '2001-01-02T00:00:00.000Z' } },
					],
				},
			],
		})
	})
	it('includes active history by default, supports explicit closed-only history and keeps live open-only', () => {
		expect(buildLobbyFilter({}, true).and).not.toContainEqual({ closedAt: { isNull: false } })
		expect(buildLobbyFilter({ active: '1' }, true).and).not.toContainEqual({
			closedAt: { isNull: false },
		})
		expect(buildLobbyFilter({ active: '0', after: 'cursor' }, true).and).toContainEqual({
			closedAt: { isNull: false },
		})
		expect(buildLobbyFilter({}, false).and).toContainEqual({ closedAt: { isNull: true } })
		expect(buildLobbyFilter({ capacity: '1', populated: '1' }, false).and).toContainEqual({
			availableCapacity: { equalTo: true },
		})
	})
	it('ignores malformed URL values and uses deterministic sorting', () => {
		expect(buildLobbyFilter({ from: '2001-01-03', to: '2001-01-01' }, true)).toEqual({
			and: [{ id: { lessThan: '0' } }, { id: { greaterThan: '0' } }],
		})
		expect(
			buildLobbyFilter({ from: 'invalid', to: 'invalid', host: 'name', minPeak: '-5' }, true),
		).toEqual(buildLobbyFilter({}, true))
		expect(lobbyOrderBy('invalid')).toEqual(['PLAYERS_DESC', 'ID_DESC'])
		expect(lobbyOrderBy('age')).toEqual(['FIRST_SEEN_ASC', 'ID_DESC'])
		expect(normalizeLobbyRange('bad')).toBe('7d')
		expect(normalizeLobbyRange(undefined, true)).toBe('24h')
	})
	it('defaults history to a one-minute minimum and enforces it for URL filters', () => {
		for (const duration of [undefined, '', '0', '-1', '0.5', ['2']]) {
			expect(buildLobbyFilter({ duration }, true).and).toContainEqual({
				durationSeconds: { greaterThanOrEqualTo: 60 },
			})
		}
		expect(buildLobbyFilter({ duration: '5' }, true).and).toContainEqual({
			durationSeconds: { greaterThanOrEqualTo: 300 },
		})
		expect(buildLobbyFilter({}, false)).toEqual({ and: [{ closedAt: { isNull: true } }] })
	})
	it('calculates participation from summed counts, with no fabricated zero denominators', () => {
		expect(lobbyRatio(140, 440)).toBeCloseTo(0.3181818)
		expect(lobbyRatio(0, 0)).toBeNull()
		expect(lobbyChange(10, 0)).toBeNull()
		expect(lobbyChange(15, 10)).toBe(0.5)
		expect(lobbyNumber(undefined)).toBeNull()
		expect(lobbyNumber('NaN')).toBeNull()
	})
	it('uses UTC calendar boundaries, equal preceding periods, and supported grouping', () => {
		const filters = lobbyStatisticsFilters('7d', Date.parse('2026-11-08T12:00:00Z'))
		expect(filters.filter.dateCreated?.greaterThanOrEqualTo).toBe('2026-11-01T12:00:00.000Z')
		expect(filters.previousFilter.dateCreated).toEqual({
			greaterThanOrEqualTo: '2026-10-25T12:00:00.000Z',
			lessThan: '2026-11-01T12:00:00.000Z',
		})
		expect(filters.roomPeakFilter).toEqual({
			changeType: { notEqualTo: 'closed' },
			observedAt: filters.filter.dateCreated,
		})
		expect(filters.roomSnapshotFilter.lastSeen).toEqual(filters.filter.dateCreated)
		expect(lobbyStatisticsFilters('all', Date.now()).roomSnapshotFilter).toEqual({
			id: { greaterThan: '0' },
		})
		expect(lobbyGrouping('all')).toBe('DATE_CREATED_TRUNCATED_TO_MONTH')
	})
	it('keeps stable cursors and distinguishes observed closed spans from active clocks', () => {
		expect(
			mapLobbyPage({
				startCursor: 'first',
				endCursor: 'last',
				hasNextPage: true,
				hasPreviousPage: false,
			}),
		).toEqual({
			startCursor: 'first',
			endCursor: 'last',
			hasNextPage: true,
			hasPreviousPage: false,
		})
		expect(lobbyDuration('2001-01-01T00:00Z', '2001-01-02T01:30Z', Date.now())).toBe(
			'1d 1h 30m',
		)
	})
	it.each([
		[0, '0s'],
		[4.9, '4s'],
		[59, '59s'],
		[60, '1m'],
		[37 * 60 + 59, '37m'],
		[3600, '1h'],
		[22 * 3600 + 48 * 60, '22h 48m'],
		[86_400, '1d'],
		[7 * 86_400 - 1, '6d 23h 59m'],
		[7 * 86_400, '1w'],
		[(3 * 7 * 24 + 21) * 3600 + 59 * 60, '3w 21h'],
		[((483 * 7 + 6) * 24 + 3) * 3600, '483w 6d 3h'],
	])('formats %d elapsed seconds as %s', (seconds, expected) => {
		const start = '2001-01-01T00:00:00Z'
		expect(lobbyDuration(start, null, Date.parse(start) + seconds * 1000)).toBe(expected)
	})
})
