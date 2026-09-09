import { expect, mock, test } from 'bun:test'
import { BitReader } from '@zeepkist/core/zeepnet'
import { RoomChat } from '../../../chat/roomChat'
import type { TrackTournamentPlayerContext } from '../leaderboard/trackTournamentLeaderboard'
import { sendTournamentWelcome } from './welcome'

const player = {
	type: 'player-connected' as const,
	uid: 42,
	steamId: 76561198000000042n,
	isHost: false,
	hasHostPowers: false,
	playerTag: '',
	backupName: 'Player',
}
const recent = { minimumGtrVersion: '1.17.3', recentRecord: true, userExists: true }
function setup() {
	const sent: Uint8Array[] = []
	const controller = new AbortController()
	const context = {
		signal: controller.signal,
		isReady: () => true,
		isHost: () => true,
		chat: new RoomChat(async (packet) => {
			sent.push(packet)
		}),
		getPlayers: () => [player],
		logger: { info: () => {}, warn: () => {} },
	}
	return { context, sent, controller }
}
test('uses GTR fallback if lookup fails', async () => {
	const { context, sent } = setup()
	await sendTournamentWelcome(
		context,
		player,
		'weekly',
		() => 42,
		async () => {
			throw new Error('GraphQL unavailable')
		},
	)
	const reader = new BitReader(sent[0] as Uint8Array)
	reader.readUInt16()
	expect(reader.readUInt64()).toBe(player.steamId)
	expect(reader.readString()).toContain(
		'You need GTR installed to join the tournament leaderboard.',
	)
})
test('retries changed tournament once then drops stale result', async () => {
	const { context, sent } = setup()
	let tournament = 42
	let resolveFirst: ((value: TrackTournamentPlayerContext) => void) | undefined
	let resolveSecond: ((value: TrackTournamentPlayerContext) => void) | undefined
	const responses = [
		new Promise<TrackTournamentPlayerContext>((resolve) => {
			resolveFirst = resolve
		}),
		new Promise<TrackTournamentPlayerContext>((resolve) => {
			resolveSecond = resolve
		}),
	]
	const lookup = mock(
		async (_id: number) => responses.shift() as Promise<TrackTournamentPlayerContext>,
	)
	const task = sendTournamentWelcome(context, player, 'weekly', () => tournament, lookup)
	tournament = 43
	resolveFirst?.(recent)
	await Bun.sleep(0)
	expect(lookup).toHaveBeenCalledTimes(2)
	tournament = 44
	resolveSecond?.(recent)
	await task
	expect(sent).toHaveLength(0)
	expect(lookup.mock.calls.map((call) => call[0])).toEqual([42, 43])
})
test('connection cancellation and player departure suppress pending response', async () => {
	for (const disconnect of [true, false]) {
		const { context, sent, controller } = setup()
		let resolve: ((value: TrackTournamentPlayerContext) => void) | undefined
		const task = sendTournamentWelcome(
			context,
			player,
			'weekly',
			() => 42,
			() =>
				new Promise((done) => {
					resolve = done
				}),
		)
		if (disconnect) controller.abort()
		else context.getPlayers = () => []
		resolve?.(recent)
		await task
		expect(sent).toHaveLength(0)
	}
})
