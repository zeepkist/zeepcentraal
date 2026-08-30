import { describe, expect, test } from 'bun:test'
import {
	buildTrackTournamentJoinMessageCommand,
	buildTrackTournamentServerMessageCommand,
	escapeUnityRichText,
	formatTournamentRemaining,
	formatTrackTournamentPeriod,
	formatTrackTournamentTime,
	leaderboardSignature,
	type TrackTournamentLeaderboardStanding,
} from './trackTournamentMessages'

const standings: TrackTournamentLeaderboardStanding[] = [
	{ rank: 1, recordId: 10, steamName: '<Winner>', time: 61.234, userId: 1 },
	{ rank: 2, recordId: 11, steamName: 'Runner & Friend', time: 62, userId: 2 },
	{ rank: 3, recordId: 12, steamName: null, time: 63.5, userId: 3 },
	{ rank: 4, recordId: 13, steamName: 'Fourth', time: 64.5, userId: 4 },
	{ rank: 5, recordId: 14, steamName: 'Fifth', time: 65.5, userId: 5 },
	{ rank: 6, recordId: 15, steamName: 'Sixth', time: 66.5, userId: 6 },
	{ rank: 7, recordId: 16, steamName: 'Hidden', time: 67.5, userId: 7 },
]
const firstStanding = standings[0] as TrackTournamentLeaderboardStanding
const secondStanding = standings[1] as TrackTournamentLeaderboardStanding
const now = Date.parse('2026-08-30T12:00:00.000Z')
const tournamentEndAt = new Date(now + (6 * 24 * 60 + 3 * 60 + 38) * 60_000).toISOString()

describe('track tournament room messages', () => {
	test('uses bounded rich join copy', () => {
		const weekly = buildTrackTournamentJoinMessageCommand('weekly')
		const monthly = buildTrackTournamentJoinMessageCommand('monthly')
		expect(weekly).toContain('/joinmessage yellow <b>Welcome')
		expect(weekly).toContain('zeepki.st/totw')
		expect(monthly).toContain('Track of the Month')
		expect(monthly).toContain('zeepki.st/totm')
		expect(new TextEncoder().encode(weekly).byteLength).toBeLessThan(4097)
	})

	test('formats weekly period and tournament times', () => {
		expect(formatTrackTournamentPeriod('weekly', '2026-w33')).toBe(
			'Track of the Week: 2026 Week 33',
		)
		expect(formatTrackTournamentPeriod('monthly', '2026-08')).toBe(
			'Track of the Month: August 2026',
		)
		expect(formatTrackTournamentPeriod('weekly', 'custom')).toBe('Track of the Week: custom')
		expect(formatTrackTournamentTime(61.234)).toBe('1:01.234')
		expect(formatTrackTournamentTime(9.5)).toBe('0:09.500')
		expect(formatTrackTournamentTime(59.9996)).toBe('1:00.000')
		expect(formatTournamentRemaining(tournamentEndAt, now)).toBe('Ends in 6d 3h 38m')
		expect(formatTournamentRemaining(tournamentEndAt, now + 60_000)).toBe('Ends in 6d 3h 37m')
		expect(formatTournamentRemaining(tournamentEndAt, Date.parse(tournamentEndAt) + 1)).toBe(
			'Ends in 0d 0h 0m',
		)
		expect(() => formatTournamentRemaining('invalid', now)).toThrow(
			'Tournament end time is invalid',
		)
	})

	test('renders escaped top six with podium colors', () => {
		const command = buildTrackTournamentServerMessageCommand(
			'weekly',
			'2026-w33',
			tournamentEndAt,
			standings,
			900,
			now,
		)
		expect(command).toStartWith(
			'/servermessage yellow 900 <b>Track of the Week: 2026 Week 33</b>',
		)
		expect(command).toContain('Ends in 6d 3h 38m')
		expect(command).toContain('<color=#FFD700>1. &lt;Winner&gt; — 1:01.234</color>')
		expect(command).toContain('<color=#C0C0C0>2. Runner &amp; Friend — 1:02.000</color>')
		expect(command).toContain('<color=#CD7F32>3. Unknown player — 1:03.500</color>')
		expect(command).toContain('<color=#FFFFFF>6. Sixth — 1:06.500</color>')
		expect(command).not.toContain('Hidden')
		expect(command).toEndWith('</size>')
	})

	test('renders loading and empty states', () => {
		expect(
			buildTrackTournamentServerMessageCommand(
				'weekly',
				'2026-w33',
				tournamentEndAt,
				undefined,
				900,
			),
		).toContain('Leaderboard loading…')
		expect(
			buildTrackTournamentServerMessageCommand(
				'weekly',
				'2026-w33',
				tournamentEndAt,
				[],
				900,
			),
		).toContain('Set a time with GTR to appear on the leaderboard!')
	})

	test('escapes tags and bounds display names by code point', () => {
		expect(escapeUnityRichText('<b>A&B</b>')).toBe('&lt;b&gt;A&amp;B&lt;/b&gt;')
		const command = buildTrackTournamentServerMessageCommand(
			'weekly',
			'2026-w33',
			tournamentEndAt,
			[
				{ ...firstStanding, steamName: '😀'.repeat(30) },
				{ ...secondStanding, steamName: '<b>Injected</b>\r\nSecond line' },
			],
			900,
			now,
		)
		expect(command).toContain(`${'😀'.repeat(23)}…`)
		expect(command).not.toContain('😀'.repeat(24))
		expect(command).toContain('&lt;b&gt;Injected&lt;/b&gt; Second')
		expect(command).not.toContain('\r')
	})

	test('signature changes only with visible leaderboard data', () => {
		expect(leaderboardSignature(standings.slice(0, 6))).toBe(
			leaderboardSignature(standings.slice(0, 6)),
		)
		expect(leaderboardSignature(standings.slice(0, 6))).not.toBe(
			leaderboardSignature([{ ...firstStanding, time: 60 }, ...standings.slice(1, 6)]),
		)
	})
})
