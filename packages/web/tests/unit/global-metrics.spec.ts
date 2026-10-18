import type { Zc_GlobalMetricsFragment } from '@zeepkist/graphql/generated'
import { describe, expect, it } from 'vitest'
import { normalizeGlobalMetrics } from '../../app/utils/globalMetrics'

const fields = [
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
	'playersAll',
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
		timeZone: 'Europe/London',
	}) as Zc_GlobalMetricsFragment

describe('global metric normalization', () => {
	it('keeps all 20 counts exact beyond Number precision and preserves period labels', () => {
		const normalized = normalizeGlobalMetrics(snapshot())
		expect(Object.values(normalized).filter((value) => typeof value === 'bigint')).toHaveLength(
			20,
		)
		expect(normalized.records).toBe(9007199254740993n)
		expect(new Intl.NumberFormat('en-GB').format(normalized.records)).toBe(
			'9,007,199,254,740,993',
		)
		expect(normalized.monthStart).toBe('2026-09-30T23:00:00Z')
	})
	it('rejects missing counts instead of displaying invented zeros', () => {
		expect(() => normalizeGlobalMetrics({ ...snapshot(), records: null })).toThrow(
			'Global metric missing',
		)
	})
})
