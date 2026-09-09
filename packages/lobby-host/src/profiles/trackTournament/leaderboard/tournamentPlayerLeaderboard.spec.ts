import { describe, expect, test } from 'bun:test'
import { BitReader, ZEEPKIST_PACKET_ID } from '@zeepkist/core/zeepnet'
import {
	TournamentPlayerLeaderboard,
	tournamentLeaderboardOverrides,
} from './tournamentPlayerLeaderboard'

const player = { uid: 4, steamId: 42n, playerTag: '[T]', backupName: '<b>Player</b>' }
const result = { steamId: '42', recordId: 3, time: 12.345, rank: 17, points: 400 }

function decode(bytes: Uint8Array) {
	const reader = new BitReader(bytes)
	expect(reader.readUInt16()).toBe(ZEEPKIST_PACKET_ID.customLeaderboard)
	const steamId = reader.readUInt64()
	expect(reader.readBoolean()).toBe(false)
	const time = reader.readFloat32()
	expect(reader.readInt32()).toBe(0)
	expect(reader.readBoolean()).toBe(false)
	const isOverride = reader.readBoolean()
	const overrides = {
		time: reader.readString(),
		position: reader.readString(),
		name: reader.readString(),
		points: reader.readString(),
		pointsWon: reader.readString(),
	}
	return { steamId, time, isOverride, overrides }
}

function setup(echo = false) {
	const sent: ReturnType<typeof decode>[] = []
	const rosters: bigint[][] = []
	const errors: string[] = []
	const sync = new TournamentPlayerLeaderboard(
		async (packet) => {
			const decoded = decode(packet)
			sent.push(decoded)
			if (echo)
				sync.observe({
					type: 'leaderboard',
					packetType: decoded.isOverride ? 2 : 1,
					times: decoded.isOverride
						? []
						: [{ steamId: decoded.steamId, time: decoded.time }],
					overrides: decoded.isOverride
						? [{ steamId: decoded.steamId, ...decoded.overrides }]
						: [],
				})
		},
		(ids) => rosters.push(ids),
		() => errors.push('failed'),
		1n,
	)
	sync.setTournament(6, 'level')
	sync.setRoster([player])
	return { sync, sent, rosters, errors }
}

describe('tournament player leaderboard', () => {
	test('only accepted changes notify; failed chat does not retry or stop leaderboard synchronization', async () => {
		let chats = 0
		let failures = 0
		const updates: ReturnType<typeof decode>[] = []
		const sync = new TournamentPlayerLeaderboard(
			async (packet) => {
				if (new BitReader(packet).readUInt16() === ZEEPKIST_PACKET_ID.customChatMessage) {
					chats++
					throw new Error('Transport failed')
				}
				updates.push(decode(packet))
			},
			() => {},
			() => {
				throw new Error('Projection must not fail')
			},
			1n,
			{ type: 'monthly', onError: () => failures++ },
		)
		try {
			sync.setTournament(6, 'level')
			sync.setRoster([player])
			sync.setReady(true)
			sync.setResults([result])
			await Bun.sleep(60)
			sync.observe({ type: 'leaderboard', packetType: 0, times: [], overrides: [] })
			sync.setReady(true)
			await Bun.sleep(1050)
			expect(chats).toBe(0)
			sync.setResults([{ ...result, rank: 18 }])
			await Bun.sleep(1100)
			expect(chats).toBe(1)
			expect(failures).toBe(1)
			sync.setResults([{ ...result, rank: 18 }])
			sync.observe({ type: 'leaderboard', packetType: 0, times: [], overrides: [] })
			await Bun.sleep(60)
			expect(updates.at(-1)?.overrides.position).toBe('18')
			expect(chats).toBe(1)
		} finally {
			sync.close()
		}
	})
	test('departure during numeric ACK prevents stale overrides; another room stays independent', async () => {
		let release: (() => void) | undefined
		const sent: ReturnType<typeof decode>[] = []
		const sync = new TournamentPlayerLeaderboard(
			async (packet) => {
				sent.push(decode(packet))
				await new Promise<void>((resolve) => {
					release = resolve
				})
			},
			() => {},
			() => {},
			1n,
		)
		const other = setup()
		try {
			sync.setTournament(6, 'level')
			sync.setRoster([player])
			sync.setResults([result])
			sync.setReady(true)
			other.sync.setResults([{ ...result, time: 44 }])
			other.sync.setReady(true)
			await Bun.sleep(60)
			sync.observe({ type: 'player-disconnected', uid: player.uid })
			release?.()
			await Bun.sleep(60)
			expect(sent).toHaveLength(1)
			expect(other.sent).toHaveLength(2)
			expect(other.sent[0]?.time).toBe(44)
		} finally {
			release?.()
			sync.close()
			other.sync.close()
		}
	})

	test('reconnected projection recovers initial roster and excludes local account', async () => {
		const { sync, sent, rosters } = setup()
		try {
			sync.observe({
				type: 'initial',
				isHost: true,
				players: [player, { ...player, uid: 1, steamId: 1n }],
			})
			sync.setResults([result])
			sync.setReady(true)
			await Bun.sleep(60)
			expect(rosters.at(-1)).toEqual([42n])
			expect(sent.map((packet) => packet.steamId)).toEqual([42n, 42n])
		} finally {
			sync.close()
		}
	})
	test('preserves native unranked time and escapeTexts tagged names', async () => {
		const { sync, sent } = setup()
		try {
			sync.setReady(true)
			await Bun.sleep(60)
			expect(sent).toHaveLength(1)
			expect(sent[0]?.isOverride).toBe(true)
			expect(sent[0]?.overrides).toEqual({
				time: '',
				position: '—',
				name: '<nobr>[T]&lt;b&gt;Player&lt;/b&gt;</nobr>',
				points: '0 pts',
				pointsWon: ' ',
			})
		} finally {
			sync.close()
		}
	})

	test('sends float32 time before overrides; matching echoes and unchanged snapshots never loop', async () => {
		const { sync, sent } = setup(true)
		try {
			sync.setResults([result])
			await Bun.sleep(40)
			expect(sent).toHaveLength(0)
			sync.setReady(true)
			await Bun.sleep(100)
			expect(sent.map((p) => p.isOverride)).toEqual([false, true])
			expect(sent[0]?.time).toBe(Math.fround(result.time))
			expect(sent[1]?.overrides.position).toBe('17')
			sync.setResults([{ ...result }])
			await Bun.sleep(80)
			expect(sent).toHaveLength(2)
		} finally {
			sync.close()
		}
	})

	test('updates outside-top-six rank/points without rewriting unchanged PB', async () => {
		const { sync, sent } = setup()
		try {
			sync.setResults([result])
			sync.setReady(true)
			await Bun.sleep(60)
			sync.setResults([{ ...result, rank: 18, points: 390 }])
			await Bun.sleep(60)
			expect(sent).toHaveLength(3)
			expect(sent[2]?.overrides.points).toBe('390 pts')
			expect(sent[2]?.overrides.position).toBe('18')
		} finally {
			sync.close()
		}
	})

	test('restores server round resets and overwritten player results', async () => {
		const { sync, sent } = setup()
		try {
			sync.setResults([result])
			sync.setReady(true)
			await Bun.sleep(60)
			sync.observe({ type: 'leaderboard', packetType: 0, times: [], overrides: [] })
			await Bun.sleep(60)
			expect(sent).toHaveLength(4)
			sync.observe({
				type: 'player-result',
				uid: 4,
				hasResult: true,
				levelUid: 'level',
				time: 30,
				checkpoints: 0,
			})
			await Bun.sleep(60)
			expect(sent).toHaveLength(5)
			expect(sent[4]?.isOverride).toBe(false)
		} finally {
			sync.close()
		}
	})

	test('drops departed players and clears prior tournament overrides before new PB', async () => {
		const { sync, sent, rosters } = setup()
		try {
			sync.setResults([result])
			sync.setReady(true)
			await Bun.sleep(60)
			sync.setReady(false)
			sync.setTournament(7, 'next')
			sync.setResults([{ ...result, time: 20 }])
			sync.setReady(true)
			await Bun.sleep(60)
			expect(sent.slice(2).map((p) => p.isOverride)).toEqual([true, false, true])
			expect(sent[2]?.overrides).toEqual({
				time: '',
				position: '',
				name: '',
				points: '',
				pointsWon: '',
			})
			sync.observe({ type: 'player-disconnected', uid: 4 })
			sync.setResults([{ ...result, time: 10 }])
			await Bun.sleep(60)
			expect(sent).toHaveLength(5)
			expect(rosters.at(-1)).toEqual([])
		} finally {
			sync.close()
		}
	})

	test('ignores unrelated level results and cancels queued writes on close', async () => {
		const { sync, sent } = setup()
		sync.setResults([result])
		sync.setReady(true)
		await Bun.sleep(60)
		sync.observe({
			type: 'player-result',
			uid: 4,
			hasResult: true,
			levelUid: 'old',
			time: 1,
			checkpoints: 0,
		})
		await Bun.sleep(60)
		expect(sent).toHaveLength(2)
		sync.setResults([{ ...result, time: 2 }])
		sync.close()
		await Bun.sleep(60)
		expect(sent).toHaveLength(2)
	})

	test('bounds names and preserves tied global ranks', () => {
		expect(
			tournamentLeaderboardOverrides(
				{ ...player, backupName: '\n'.repeat(10) + 'x'.repeat(1000) },
				result,
			).name,
		).toHaveLength(93)
		expect(tournamentLeaderboardOverrides(player, { ...result, rank: 1 }).position).toBe('1')
	})
})
