import { describe, expect, test } from 'bun:test'
import {
	calculateTrackTournamentPoints,
	getTrackTournamentPeriod,
	isTrackTournamentBoundary,
	TRACK_TOURNAMENT_TYPE,
} from './trackTournamentHelpers'

describe('track tournament periods', () => {
	test('uses Monday 06:00 UTC weekly boundaries and ISO slugs', () => {
		const period = getTrackTournamentPeriod(
			TRACK_TOURNAMENT_TYPE.weekly,
			new Date('2026-07-22T12:00:00Z'),
		)
		expect(period.start.toISOString()).toBe('2026-07-20T06:00:00.000Z')
		expect(period.end.toISOString()).toBe('2026-07-27T06:00:00.000Z')
		expect(period.slug).toBe('2026-w30')
	})

	test('uses first-day 06:00 UTC monthly boundaries', () => {
		const period = getTrackTournamentPeriod(
			TRACK_TOURNAMENT_TYPE.monthly,
			new Date('2026-07-01T05:59:59Z'),
		)
		expect(period.start.toISOString()).toBe('2026-06-01T06:00:00.000Z')
		expect(period.end.toISOString()).toBe('2026-07-01T06:00:00.000Z')
		expect(period.slug).toBe('2026-06')
	})

	test('recognizes only scheduled UTC boundary hours', () => {
		expect(
			isTrackTournamentBoundary(
				TRACK_TOURNAMENT_TYPE.weekly,
				new Date('2026-07-20T06:00:00Z'),
			),
		).toBe(true)
		expect(
			isTrackTournamentBoundary(
				TRACK_TOURNAMENT_TYPE.weekly,
				new Date('2026-07-22T06:00:00Z'),
			),
		).toBe(false)
		expect(
			isTrackTournamentBoundary(
				TRACK_TOURNAMENT_TYPE.monthly,
				new Date('2026-08-01T06:00:00Z'),
			),
		).toBe(true)
	})
})

test('ceil-rounds tournament curve upward to even points', () => {
	expect([1, 10, 50, 100, 160].map(calculateTrackTournamentPoints)).toEqual([
		1000, 694, 136, 18, 2,
	])
})

describe('track tournament transaction SQL', () => {
	const source = Bun.file(new URL('./trackTournament.ts', import.meta.url)).text()

	test('uses type-specific age and quality thresholds before same-type exclusion', async () => {
		const sql = await source
		expect(sql).toMatch(
			/\[TRACK_TOURNAMENT_TYPE\.weekly\]: \{\s+minimumPointPercentile: 0\.9,\s+maximumAgeDays: 60/,
		)
		expect(sql).toMatch(
			/\[TRACK_TOURNAMENT_TYPE\.monthly\]: \{\s+minimumPointPercentile: 0\.9,\s+maximumAgeDays: 30/,
		)
		expect(sql).toContain('eligibility = TRACK_TOURNAMENT_LEVEL_ELIGIBILITY[type]')
		expect(sql).toContain('const createdAfter = new Date(')
		expect(sql).toContain('at.getTime() - eligibility.maximumAgeDays * 86_400_000')
		expect(sql).toContain('candidate_level.date_created >= $' + '{createdAfter}')
		expect(sql).not.toContain('display_item.created_at')
		expect(sql).not.toContain('display_item.updated_at')
		expect(sql).toContain('selectTrackTournamentLevel(tx, type, at)')
		expect(
			sql.indexOf('PERCENTILE_CONT($' + '{eligibility.minimumPointPercentile})'),
		).toBeLessThan(sql.indexOf('FROM $' + '{trackTournament} AS used_tournament'))
		expect(sql).toContain('used_tournament.type = $' + '{type}')
	})

	test('uses half-open active windows, improvement-only upserts, and shared ranking', async () => {
		const sql = await source
		expect(sql).toContain('tournament.finalized_at IS NULL')
		expect(sql).toContain('tournament.start_at <= $' + '{input.acceptedAt}')
		expect(sql).toContain('tournament.end_at > $' + '{input.acceptedAt}')
		expect(sql).toContain('EXCLUDED.time < $' + '{trackTournamentResult.time}')
		expect(sql).toContain('potentialImprovements.length === 0')
		expect(sql).toContain('TRACK_TOURNAMENT_RESULT_LOCK_NAMESPACE')
		expect(sql).toContain('RANK() OVER')
	})

	test('serializes finalization and selection against record insertion without backfill', async () => {
		const sql = await source
		expect(sql.match(/pg_advisory_xact_lock\(0, \$\{/g)).toHaveLength(2)
		expect(sql).not.toContain('backfillTrackTournamentResults')
	})
})
