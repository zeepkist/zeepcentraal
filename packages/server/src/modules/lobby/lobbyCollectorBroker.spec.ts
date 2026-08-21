import { expect, mock, test } from 'bun:test'
import { BitReader, ZEEPKIST_PACKET_ID } from '@zeepkist/core/zeepnet'
import { LobbyCollector } from './lobbyCollector'

test('rejoins stored room without requiring public lobby-list visibility', async () => {
	const collector = createCollector((payload, inbox) => {
		expect(new BitReader(payload).readUInt16()).toBe(ZEEPKIST_PACKET_ID.joinLobby)
		inbox.push({ type: 'join', result: 1, host: '10.0.0.1', port: 27000 })
	})
	expect(await collector.assignRoom('private-room')).toEqual({
		host: '10.0.0.1',
		joinId: 'private-room',
		playerUid: 7,
		port: 27000,
		steamId: '76561198000000000',
		token: 'ephemeral-token',
	})
})

test('creates replacement when stored room cannot be joined', async () => {
	const packetIds: number[] = []
	const collector = createCollector((payload, inbox) => {
		const id = new BitReader(payload).readUInt16()
		packetIds.push(id)
		if (id === ZEEPKIST_PACKET_ID.joinLobby) {
			inbox.push({ type: 'join', result: 4, host: '', port: 0 })
		} else {
			inbox.push({ type: 'create', result: 1, joinId: 'replacement-room' })
			inbox.push({ type: 'join', result: 1, host: '10.0.0.2', port: 27001 })
		}
	})
	const assignment = await collector.assignRoom('missing-room')
	expect(packetIds).toEqual([ZEEPKIST_PACKET_ID.joinLobby, ZEEPKIST_PACKET_ID.createLobby])
	expect(assignment.joinId).toBe('replacement-room')
})

test('serializes concurrent broker assignment requests', async () => {
	let releaseSend: (() => void) | undefined
	const sendReleased = new Promise<void>((resolve) => {
		releaseSend = resolve
	})
	const send = mock(async (_payload: Uint8Array, inbox: ResponseInbox) => {
		await sendReleased
		inbox.push({ type: 'join', result: 1, host: '10.0.0.1', port: 27000 })
	})
	const collector = createCollector(send)
	const first = collector.assignRoom('same-room')
	const second = collector.assignRoom('same-room')
	expect(first).toBe(second)
	releaseSend?.()
	await Promise.all([first, second])
	expect(send).toHaveBeenCalledTimes(1)
})

type ResponseInbox = {
	push(
		response:
			| { type: 'create'; result: number; joinId: string }
			| { type: 'join'; result: number; host: string; port: number },
	): void
}

function createCollector(
	onSend: (payload: Uint8Array, inbox: ResponseInbox) => void | Promise<void>,
) {
	const collector = new LobbyCollector(
		{
			appId: 1_440_670,
			build: 2043,
			host: '127.0.0.1',
			port: 26900,
			refreshTokenFile: '',
			room: { isPublic: true, maxPlayers: 64, name: 'Room' },
		},
		() => {},
		async () => {},
	)
	const internals = collector as unknown as {
		identity: { name: string; steamId: bigint }
		lidgren: { sendReliableOrdered(payload: Uint8Array): Promise<void> }
		masterPlayerUid: number
		masterToken: string
		roomResponses: ResponseInbox
	}
	internals.identity = { name: 'Host', steamId: 76561198000000000n }
	internals.masterPlayerUid = 7
	internals.masterToken = 'ephemeral-token'
	internals.lidgren = {
		sendReliableOrdered: async (payload) => onSend(payload, internals.roomResponses),
	}
	return collector
}
