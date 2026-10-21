import type { Zc_GlobalMetricsFragment } from '@zeepkist/graphql/generated'
import { describe, expect, it } from 'vitest'
import { normalizeGlobalMetrics } from '../../app/utils/globalMetrics'

const fields = [
	'recordsYesterday',
	'recordsLastMonth',
	'personalBestsYesterday',
	'personalBestsLastMonth',
	'worldRecordsYesterday',
	'worldRecordsLastMonth',
	'levelsYesterday',
	'levelsLastMonth',
	'votesYesterday',
	'votesLastMonth',
	'activePlayersYesterday',
	'activePlayersLastMonth',
	'records',
	'recordsToday',
	'recordsMonth',
	'personalBests',
	'personalBestsToday',
	'personalBestsMonth',
	'worldRecords',
	'worldRecordsToday',
	'worldRecordsMonth',
	'levels',
	'levelsToday',
	'levelsMonth',
	'votes',
	'votesToday',
	'votesMonth',
	'players',
	'rankedPlayers',
	'activePlayersToday',
	'activePlayersMonth',
]
const snapshot = () =>
	({
		...Object.fromEntries(fields.map((name) => [name, '9007199254740993'])),
		asOf: '2026-10-18T12:00:00Z',
		dayStart: '2026-10-17T23:00:00Z',
		monthStart: '2026-09-30T23:00:00Z',
		yesterdayStart: '2026-10-16T23:00:00Z',
		lastMonthStart: '2026-08-31T23:00:00Z',
		timeZone: 'Europe/London',
	}) as Zc_GlobalMetricsFragment

describe('global metric normalization', () => {
	it('keeps all 31 counts exact beyond Number precision and preserves period labels', () => {
		const normalized = normalizeGlobalMetrics(snapshot())
		expect(Object.values(normalized).filter((value) => typeof value === 'bigint')).toHaveLength(
			31,
		)
		for (const field of fields)
			expect(normalized[field as keyof typeof normalized]).toBe(9007199254740993n)
		expect(new Intl.NumberFormat('en-GB').format(normalized.records)).toBe(
			'9,007,199,254,740,993',
		)
		expect(normalized.monthStart).toBe('2026-09-30T23:00:00Z')
		expect(normalized.yesterdayStart).toBe('2026-10-16T23:00:00Z')
		expect(normalized.lastMonthStart).toBe('2026-08-31T23:00:00Z')
	})
	it('rejects missing counts instead of displaying invented zeros', () => {
		for (const field of fields) {
			expect(() => normalizeGlobalMetrics({ ...snapshot(), [field]: null })).toThrow(
				'Global metric missing',
			)
		}
	})
})
