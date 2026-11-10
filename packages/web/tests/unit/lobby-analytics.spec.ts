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
	lobbyStatisticsFilters,
	mapLobbyPage,
	normalizeLobbyRange,
	withLobbyChartGaps,
} from '../../app/utils/lobbyAnalytics'

describe('lobby analytics semantics', () => {
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
		expect(normalizeLobbyRange('bad')).toBe('24h')
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
		const filters = lobbyStatisticsFilters('7d', 'today', Date.parse('2026-11-08T12:00:00Z'))
		expect(filters.filter.dateCreated?.greaterThanOrEqualTo).toBe('2026-11-01T12:00:00.000Z')
		expect(filters.previousFilter.dateCreated).toEqual({
			greaterThanOrEqualTo: '2026-10-25T12:00:00.000Z',
			lessThan: '2026-11-01T12:00:00.000Z',
		})
		expect(filters.peakFilter.dateCreated?.greaterThanOrEqualTo).toBe(
			'2026-11-08T00:00:00.000Z',
		)
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
		expect(lobbyDuration('2001-01-01T00:00Z', '2001-01-02T01:30Z', Date.now())).toEqual({
			days: 1,
			hours: 1,
			minutes: 30,
		})
		expect(lobbyDuration('2001-01-01T00:00Z', null, Date.parse('2001-01-01T01:00Z'))).toEqual({
			days: 0,
			hours: 1,
			minutes: 0,
		})
	})
})
