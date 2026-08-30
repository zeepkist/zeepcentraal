import { describe, expect, test } from 'bun:test'
import {
	buildTotwServerMessageCommand,
	escapeUnityRichText,
	formatTotwPeriod,
	formatTotwTime,
	leaderboardSignature,
	TOTW_JOIN_MESSAGE_COMMAND,
	type TotwLeaderboardStanding,
} from './totwMessages'

const standings: TotwLeaderboardStanding[] = [
	{ rank: 1, recordId: 10, steamName: '<Winner>', time: 61.234, userId: 1 },
	{ rank: 2, recordId: 11, steamName: 'Runner & Friend', time: 62, userId: 2 },
	{ rank: 3, recordId: 12, steamName: null, time: 63.5, userId: 3 },
	{ rank: 4, recordId: 13, steamName: 'Fourth', time: 64.5, userId: 4 },
	{ rank: 5, recordId: 14, steamName: 'Fifth', time: 65.5, userId: 5 },
	{ rank: 6, recordId: 15, steamName: 'Sixth', time: 66.5, userId: 6 },
	{ rank: 7, recordId: 16, steamName: 'Hidden', time: 67.5, userId: 7 },
]
const firstStanding = standings[0] as TotwLeaderboardStanding
const secondStanding = standings[1] as TotwLeaderboardStanding

describe('TotW room messages', () => {
	test('uses bounded rich join copy', () => {
		expect(TOTW_JOIN_MESSAGE_COMMAND).toContain('/joinmessage yellow <b>Welcome')
		expect(TOTW_JOIN_MESSAGE_COMMAND).toContain('<size=80%>')
		expect(TOTW_JOIN_MESSAGE_COMMAND).toContain('zeepki.st/totw')
		expect(TOTW_JOIN_MESSAGE_COMMAND).toContain('GTR must be installed and running')
		expect(new TextEncoder().encode(TOTW_JOIN_MESSAGE_COMMAND).byteLength).toBeLessThan(4097)
	})

	test('formats weekly period and tournament times', () => {
		expect(formatTotwPeriod('2026-w33')).toBe('Track of the Week: 2026 Week 33')
		expect(formatTotwPeriod('custom')).toBe('Track of the Week: custom')
		expect(formatTotwTime(61.234)).toBe('1:01.234')
		expect(formatTotwTime(9.5)).toBe('0:09.500')
		expect(formatTotwTime(59.9996)).toBe('1:00.000')
	})

	test('renders escaped top six with podium colors', () => {
		const command = buildTotwServerMessageCommand('2026-w33', standings, 900)
		expect(command).toStartWith(
			'/servermessage yellow 900 <b>Track of the Week: 2026 Week 33</b>',
		)
		expect(command).toContain('<color=#FFD700>1. &lt;Winner&gt; — 1:01.234</color>')
		expect(command).toContain('<color=#C0C0C0>2. Runner &amp; Friend — 1:02.000</color>')
		expect(command).toContain('<color=#CD7F32>3. Unknown player — 1:03.500</color>')
		expect(command).toContain('<color=#FFFFFF>6. Sixth — 1:06.500</color>')
		expect(command).not.toContain('Hidden')
		expect(command).toEndWith('</size>')
	})

	test('renders loading and empty states', () => {
		expect(buildTotwServerMessageCommand('2026-w33', undefined, 900)).toContain(
			'Leaderboard loading…',
		)
		expect(buildTotwServerMessageCommand('2026-w33', [], 900)).toContain(
			'No tournament times yet',
		)
	})

	test('escapes tags and bounds display names by code point', () => {
		expect(escapeUnityRichText('<b>A&B</b>')).toBe('&lt;b&gt;A&amp;B&lt;/b&gt;')
		const command = buildTotwServerMessageCommand(
			'2026-w33',
			[
				{ ...firstStanding, steamName: '😀'.repeat(30) },
				{ ...secondStanding, steamName: '<b>Injected</b>\r\nSecond line' },
			],
			900,
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
