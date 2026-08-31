import { describe, expect, test } from 'bun:test'
import {
	buildTrackTournamentJoinMessage,
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
	test('builds exact weekly rich join message', () => {
		const result = buildTrackTournamentJoinMessage({
			minimumGtrVersion: '1.2.3',
			playerName: 'Player One',
			requireGtr: false,
			type: 'weekly',
		})
		expect(result).toEqual({
			hostname: '<color=#facc15>HOST</color>',
			message:
				'<size=85%><#dedede>Welcome to Track of the Week, Player One<br><br>A time attack tournament featuring a unique level each week.<br><br>View the full tournament leaderboard on <u>zeepki.st/totw</u>!<br><br><size=65%>This is an unattended room, so chat is not monitored. If you find something wrong, please contact Akane on Discord.</size></color></size>',
		})
	})

	test('builds monthly conditional paragraphs and escapes inputs', () => {
		const result = buildTrackTournamentJoinMessage({
			minimumGtrVersion: '<1.17&>',
			playerName: '<b>Alice</b>\r\nSecond',
			requireGtr: true,
			standing: { rank: 12, time: 34.234 },
			type: 'monthly',
		})
		expect(result.hostname).toBe('<color=#facc15>HOST</color>')
		expect(result.message).toContain(
			'Welcome to Track of the Month, &lt;b&gt;Alice&lt;/b&gt; Second',
		)
		expect(result.message).toContain('a unique level each month.')
		expect(result.message).toContain('<u>zeepki.st/totm</u>!')
		expect(result.message).toContain(
			'You need GTR &lt;1.17&amp;&gt;+ installed to join the tournament leaderboard.',
		)
		expect(result.message).toContain(
			'You are currently #12 on the tournament leaderboard with 00:34.234.',
		)
		expect(result.message).not.toContain('\n')
		expect(new TextEncoder().encode(result.message).byteLength).toBeLessThan(4_097)
	})

	test('uses generic GTR wording and safely truncates player names', () => {
		const result = buildTrackTournamentJoinMessage({
			minimumGtrVersion: null,
			playerName: '😀'.repeat(30),
			requireGtr: true,
			type: 'weekly',
		})
		expect(result.message).toContain(`Welcome to Track of the Week, ${'😀'.repeat(23)}…`)
		expect(result.message).toContain(
			'You need GTR installed to join the tournament leaderboard.',
		)
	})

	test('formats weekly period and tournament times', () => {
		expect(formatTrackTournamentPeriod('weekly', '2026-w33')).toBe(
			'Track of the Week: 2026 Week 33',
		)
		expect(formatTrackTournamentPeriod('monthly', '2026-08')).toBe(
			'Track of the Month: August 2026',
		)
		expect(formatTrackTournamentPeriod('weekly', 'custom')).toBe('Track of the Week: custom')
		expect(formatTrackTournamentTime(61.234)).toBe('01:01.234')
		expect(formatTrackTournamentTime(9.5)).toBe('00:09.500')
		expect(formatTrackTournamentTime(59.9996)).toBe('01:00.000')
		expect(formatTrackTournamentTime(6_000)).toBe('100:00.000')
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
			42,
			900,
			now,
		)
		expect(command).toStartWith(
			'/servermessage yellow 900 <b>Track of the Week: 2026 Week 33</b>',
		)
		expect(command).toContain('<size=120%>42 Entries Ends in 6d 3h 38m\n')
		expect(command).toContain('<color=#FFD700>1. &lt;Winner&gt; — 01:01.234</color>')
		expect(command).toContain('<color=#C0C0C0>2. Runner &amp; Friend — 01:02.000</color>')
		expect(command).toContain('<color=#CD7F32>3. Unknown player — 01:03.500</color>')
		expect(command).toContain('<color=#FFFFFF>6. Sixth — 01:06.500</color>')
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
				undefined,
				900,
			),
		).toContain('<size=120%>… Entries Ends in ')
		expect(
			buildTrackTournamentServerMessageCommand(
				'weekly',
				'2026-w33',
				tournamentEndAt,
				[],
				0,
				900,
			),
		).toContain('0 Entries Ends in ')
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
			2,
			900,
			now,
		)
		expect(command).toContain(`${'😀'.repeat(23)}…`)
		expect(command).not.toContain('😀'.repeat(24))
		expect(command).toContain('&lt;b&gt;Injected&lt;/b&gt; Second')
		expect(command).not.toContain('\r')
	})

	test('signature changes only with visible leaderboard data', () => {
		expect(leaderboardSignature(standings.slice(0, 6), 7)).toBe(
			leaderboardSignature(standings.slice(0, 6), 7),
		)
		expect(leaderboardSignature(standings.slice(0, 6), 7)).not.toBe(
			leaderboardSignature([{ ...firstStanding, time: 60 }, ...standings.slice(1, 6)], 7),
		)
		expect(leaderboardSignature(standings.slice(0, 6), 7)).not.toBe(
			leaderboardSignature(standings.slice(0, 6), 8),
		)
	})
})
