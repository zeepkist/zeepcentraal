import { describe, expect, test } from 'vitest'
import type { TournamentStanding } from '../../app/types/tournament'
import {
	formatTournamentDelta,
	formatTournamentPeriod,
	isTrackTournamentActive,
	nextTournamentBoundary,
	orderTournamentGhostSources,
	shouldShowTournamentHowTo,
} from '../../app/utils/tournament'
import { selectTournamentNotificationKind } from '../../app/utils/tournamentNotification'

function standing(
	recordId: number,
	time: number,
	ghostUrl: string | null = `https://cdn.example.test/${recordId}.ghost`,
): TournamentStanding {
	return {
		tournamentId: 1,
		userId: recordId,
		recordId,
		time,
		rank: recordId,
		points: 0,
		steamId: String(recordId),
		steamName: `Player ${recordId}`,
		setAt: '2026-07-28T12:00:00.000Z',
		ghost: {
			recordId,
			levelId: 42,
			userId: recordId,
			userSteamId: String(recordId),
			userName: `Player ${recordId}`,
			time,
			dateCreated: '2026-07-28T12:00:00.000Z',
			ghostUrl,
			mediaRevision: null,
			isWorldRecord: false,
			isPersonalBest: true,
		},
	}
}

describe('nextTournamentBoundary', () => {
	test('returns Monday 06:00 UTC for weekly tournaments', () => {
		expect(nextTournamentBoundary(0, new Date('2026-07-22T12:00:00Z')).toISOString()).toBe(
			'2026-07-27T06:00:00.000Z',
		)
		expect(nextTournamentBoundary(0, new Date('2026-07-27T05:00:00Z')).toISOString()).toBe(
			'2026-07-27T06:00:00.000Z',
		)
		expect(nextTournamentBoundary(0, new Date('2026-07-27T06:04:00Z')).toISOString()).toBe(
			'2026-07-27T06:00:00.000Z',
		)
		expect(nextTournamentBoundary(0, new Date('2026-07-27T06:06:00Z')).toISOString()).toBe(
			'2026-08-03T06:00:00.000Z',
		)
	})

	test('returns first-day 06:00 UTC for monthly tournaments', () => {
		expect(nextTournamentBoundary(1, new Date('2026-07-22T12:00:00Z')).toISOString()).toBe(
			'2026-08-01T06:00:00.000Z',
		)
		expect(nextTournamentBoundary(1, new Date('2026-08-01T06:04:00Z')).toISOString()).toBe(
			'2026-08-01T06:00:00.000Z',
		)
	})
})

describe('formatTournamentPeriod', () => {
	const weekly = ({ year, week }: { year: number; week: number }) => `${year} Week ${week}`

	test('formats weekly slugs through translated label callback', () => {
		expect(formatTournamentPeriod(0, '2026-w01', 'en', weekly)).toBe('2026 Week 1')
		expect(formatTournamentPeriod(0, '2027-w53', 'en', weekly)).toBe('2027 Week 53')
	})

	test('formats monthly slugs with localized month names', () => {
		expect(formatTournamentPeriod(1, '2026-01', 'en', weekly)).toBe('January 2026')
		expect(formatTournamentPeriod(1, '2026-07', 'en', weekly)).toBe('July 2026')
	})

	test('falls back to malformed raw slugs', () => {
		expect(formatTournamentPeriod(0, '2026-w00', 'en', weekly)).toBe('2026-w00')
		expect(formatTournamentPeriod(1, '2026-13', 'en', weekly)).toBe('2026-13')
	})
})

describe('formatTournamentDelta', () => {
	test('uses positive gaps from first place and hides tied leaders', () => {
		expect(formatTournamentDelta(42.123, 42.123)).toBeNull()
		expect(formatTournamentDelta(42.1234, 42.123)).toBeNull()
		expect(formatTournamentDelta(42.246, 42.123)).toBe('+0.123')
	})

	test('uses race-time formatting for gaps of at least one minute', () => {
		expect(formatTournamentDelta(112.123, 42.123)).toBe('+1:10.000')
	})
})

describe('orderTournamentGhostSources', () => {
	test('filters missing ghosts and orders ties by record id', () => {
		const ordered = orderTournamentGhostSources([
			standing(4, 12),
			standing(3, 10),
			standing(2, 10),
			standing(1, 8, null),
		])

		expect(ordered.map(({ recordId }) => recordId)).toEqual([2, 3, 4])
	})

	test('keeps fastest 200 records', () => {
		const ordered = orderTournamentGhostSources(
			Array.from({ length: 205 }, (_, index) => standing(index + 1, 205 - index)),
		)

		expect(ordered).toHaveLength(200)
		expect(ordered[0]?.recordId).toBe(205)
		expect(ordered.at(-1)?.recordId).toBe(6)
	})
})

describe('live tournament presentation', () => {
	const tournament = {
		startAt: '2026-07-28T12:00:00.000Z',
		endAt: '2026-07-28T13:00:00.000Z',
		finalizedAt: null,
	}

	test('uses inclusive start, exclusive end, and finalized exclusion', () => {
		expect(isTrackTournamentActive(tournament, new Date('2026-07-28T11:59:59.999Z'))).toBe(
			false,
		)
		expect(isTrackTournamentActive(tournament, new Date(tournament.startAt))).toBe(true)
		expect(isTrackTournamentActive(tournament, new Date('2026-07-28T12:30:00.000Z'))).toBe(true)
		expect(isTrackTournamentActive(tournament, new Date(tournament.endAt))).toBe(false)
		expect(
			isTrackTournamentActive(
				{ ...tournament, finalizedAt: '2026-07-28T12:30:00.000Z' },
				new Date('2026-07-28T12:30:00.000Z'),
			),
		).toBe(false)
	})

	test('shows join guide only to active anonymous or unranked viewers', () => {
		expect(shouldShowTournamentHowTo(true, false, false)).toBe(true)
		expect(shouldShowTournamentHowTo(true, true, false)).toBe(true)
		expect(shouldShowTournamentHowTo(true, true, true)).toBe(false)
		expect(shouldShowTournamentHowTo(false, false, false)).toBe(false)
		expect(shouldShowTournamentHowTo(false, true, false)).toBe(false)
		expect(shouldShowTournamentHowTo(false, true, true)).toBe(false)
	})
})

test('plays only highest tournament placement chime in a batch', () => {
	expect(selectTournamentNotificationKind([])).toBeNull()
	expect(selectTournamentNotificationKind([40, 12])).toBe('record')
	expect(selectTournamentNotificationKind([8, 3])).toBe('third')
	expect(selectTournamentNotificationKind([3, 2])).toBe('second')
	expect(selectTournamentNotificationKind([3, 1, 2])).toBe('first')
})
