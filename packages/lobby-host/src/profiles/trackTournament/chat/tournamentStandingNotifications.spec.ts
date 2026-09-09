import { describe, expect, test } from 'bun:test'
import { BitReader, ZEEPKIST_PACKET_ID } from '@zeepkist/core/zeepnet'
import {
	buildTournamentStandingMessage,
	TournamentStandingNotifications,
} from './tournamentStandingNotifications'

const result = { steamId: '42', recordId: 1, time: 34.75, rank: 15, points: 630 }

function setup(fail = false) {
	const sent: { id: bigint; message: string; hostname: string }[] = []
	let errors = 0
	const notifications = new TournamentStandingNotifications(
		'weekly',
		async (packet) => {
			const reader = new BitReader(packet)
			expect(reader.readUInt16()).toBe(ZEEPKIST_PACKET_ID.customChatMessage)
			sent.push({
				id: reader.readUInt64(),
				message: reader.readString(),
				hostname: reader.readString(),
			})
			if (fail) throw new Error('private transport details')
		},
		() => errors++,
		30,
	)
	notifications.setRoster([42n, 43n])
	notifications.setReady(true)
	return { notifications, sent, errors: () => errors }
}

describe('targeted tournament standing messages', () => {
	test('default coalescing window is one second and does not slide on each update', async () => {
		let count = 0
		const notifications = new TournamentStandingNotifications(
			'weekly',
			async () => {
				count++
			},
			() => {},
		)
		try {
			notifications.setRoster([42n])
			notifications.setReady(true)
			notifications.update([result])
			notifications.update([{ ...result, rank: 14 }])
			await Bun.sleep(600)
			expect(count).toBe(0)
			notifications.update([{ ...result, rank: 13 }])
			await Bun.sleep(550)
			expect(count).toBe(1)
		} finally {
			notifications.close()
		}
	})
	test('formats PB, rank, points and precise signed deltas', () => {
		const message = buildTournamentStandingMessage('weekly', result, {
			...result,
			rank: 12,
			time: 34.234,
			points: 656,
		})
		expect(message).toContain('<b>Track of the Week — New personal best!</b>')
		expect(message).toContain('#12')
		expect(message).toContain('up 3 positions')
		expect(message).not.toMatch(/[↑↓]/u)
		expect(message).toContain('00:34.234')
		expect(message).toContain('<color=#86efac>0.516s</color>')
		expect(message).toContain('656 pts')
		expect(message).toContain('+26')
		expect(message).not.toContain('#fca5a5')
	})
	test('formats drops, ties, zero deltas and first result without invented deltas', () => {
		const drop = buildTournamentStandingMessage('monthly', result, {
			...result,
			rank: 16,
			points: 620,
		})
		expect(drop).toContain('Track of the Month — Rank dropped')
		expect(drop).toContain('<color=#fca5a5>down 1 position</color>')
		expect(drop).not.toMatch(/[↑↓]/u)
		expect(drop).toContain('00:34.750 (unchanged)')
		expect(drop).toContain('−10')
		const pb = buildTournamentStandingMessage('weekly', result, { ...result, time: 34.7 })
		expect(pb).toContain('#15 (unchanged)')
		expect(pb).toContain('630 pts (unchanged)')
		const first = buildTournamentStandingMessage('weekly', undefined, result)
		expect(first).toContain('First tournament result!')
		expect(first).not.toContain('unchanged')
		expect(first).not.toContain('↑')
		expect(first).not.toContain('↓')
	})
	test('initial snapshot silent; coalesces earliest baseline to latest result for one target only', async () => {
		const { notifications, sent } = setup()
		try {
			notifications.update([result])
			await Bun.sleep(45)
			expect(sent).toHaveLength(0)
			notifications.update([{ ...result, rank: 14 }])
			notifications.update([{ ...result, rank: 12, time: 34.234, points: 656 }])
			await Bun.sleep(50)
			expect(sent).toHaveLength(1)
			expect(sent[0]?.id).toBe(42n)
			expect(sent[0]?.hostname).toBe('<color=#facc15>HOST</color>')
			expect(sent[0]?.message).toContain('up 3 positions')
			expect(sent[0]?.message).toContain('<color=#86efac>0.516s</color>')
		} finally {
			notifications.close()
		}
	})
	test('suppresses net reversals, unchanged/points-only records; accepts same-rank PB', async () => {
		const { notifications, sent } = setup()
		try {
			notifications.update([result])
			notifications.update([{ ...result, rank: 14 }])
			notifications.update([result])
			await Bun.sleep(50)
			expect(sent).toHaveLength(0)
			notifications.update([{ ...result, points: 650, recordId: 2 }])
			await Bun.sleep(50)
			expect(sent).toHaveLength(0)
			notifications.update([{ ...result, points: 650, time: 34 }])
			await Bun.sleep(50)
			expect(sent).toHaveLength(1)
			expect(sent[0]?.message).toContain('New personal best!')
			expect(sent[0]?.message).toContain('650 pts (unchanged)')
		} finally {
			notifications.close()
		}
	})
	test('first accepted result after confirmed unranked; removed result resets baseline silently', async () => {
		const { notifications, sent } = setup()
		try {
			notifications.update([])
			notifications.update([result])
			await Bun.sleep(50)
			expect(sent[0]?.message).toContain('First tournament result!')
			notifications.update([{ ...result, rank: 10 }])
			notifications.update([])
			await Bun.sleep(50)
			expect(sent).toHaveLength(1)
		} finally {
			notifications.close()
		}
	})
	test('departures, tournament switch, suspension and shutdown cancel pending sends', async () => {
		for (const cancel of ['leave', 'reset', 'pause', 'close']) {
			const { notifications, sent } = setup()
			notifications.update([result])
			notifications.update([{ ...result, rank: 10 }])
			if (cancel === 'leave') notifications.setRoster([])
			if (cancel === 'reset') notifications.reset()
			if (cancel === 'pause') notifications.setReady(false)
			if (cancel === 'close') notifications.close()
			await Bun.sleep(50)
			expect(sent).toHaveLength(0)
			notifications.close()
		}
	})
	test('retains baseline across missing snapshots; independent rooms and failure without replay', async () => {
		const a = setup(true)
		const b = setup()
		try {
			a.notifications.update([result])
			b.notifications.update([result])
			await Bun.sleep(50)
			a.notifications.update([{ ...result, rank: 20 }])
			await Bun.sleep(50)
			expect(a.sent).toHaveLength(1)
			expect(a.sent[0]?.message).toContain('down 5 positions')
			expect(a.errors()).toBe(1)
			expect(b.sent).toHaveLength(0)
			a.notifications.update([{ ...result, rank: 20 }])
			await Bun.sleep(70)
			expect(a.sent).toHaveLength(1)
		} finally {
			a.notifications.close()
			b.notifications.close()
		}
	})
})
