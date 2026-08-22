import { expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import dgram from 'node:dgram'
import {
	BitReader,
	BitWriter,
	encodeZeepkistLevelPayload,
	ZEEPKIST_PACKET_ID,
} from '@zeepkist/core/zeepnet'

const preparedPayload = encodeZeepkistLevelPayload('15,uid\n', true)
const getJoinId = mock(async () => undefined)
const setJoinId = mock(async () => {})
const clearJoinId = mock(async () => {})
const getAsset = mock(async () => ({
	idTournament: 42,
	workshopId: 123n,
	fileUid: 'uid',
	levelName: 'Track',
	author: 'Author',
	collaborators: '',
	overrideAuthorName: '',
	objectKey: 'private/asset.gz',
	contentSha256: createHash('sha256').update(preparedPayload).digest('hex'),
	byteSize: preparedPayload.length,
}))

mock.module('@zeepkist/database', () => ({
	clearManagedLobbyJoinId: clearJoinId,
	downloadTrackTournamentLobbyAsset: async () => preparedPayload,
	getManagedLobbyJoinId: getJoinId,
	getPreferredTrackTournamentLobbyAsset: getAsset,
	setManagedLobbyJoinId: setJoinId,
}))

const { TotwLobbyHost } = await import('./totwLobbyHost')

test('hosts looping playlist, supplies level data, and privatizes on shutdown', async () => {
	const blockedFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const sentPacketIds: number[] = []
	let resolveLevelData: (() => void) | undefined
	let levelLoadedCount = 0
	const levelDataSent = new Promise<void>((resolve) => {
		resolveLevelData = resolve
	})
	let incomingSequence = 0
	gameServer.on('message', (data, remote) => {
		if (data[0] === 131) {
			const reader = new BitReader(data.subarray(5))
			expect(reader.readString()).toBe('GameServer')
			reader.readInt64()
			reader.readFloat32()
			expect(reader.readString()).toBe('ephemeral-token')
			gameServer.send(connectResponse(), remote.port, remote.address)
			return
		}
		if (data[0] === 133) {
			gameServer.send(
				reliable(initialStatePacket(), incomingSequence++),
				remote.port,
				remote.address,
			)
			return
		}
		if (data[0] !== 67) return
		gameServer.send(acknowledgement(data), remote.port, remote.address)
		const packetId = new BitReader(data.subarray(5)).readUInt16()
		sentPacketIds.push(packetId)
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			gameServer.send(
				reliable(levelRequestPacket(), incomingSequence++),
				remote.port,
				remote.address,
			)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelLoaded && ++levelLoadedCount === 2)
			resolveLevelData?.()
	})

	const broker = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: () =>
			Response.json({
				host: '127.0.0.1',
				joinId: 'managed-room',
				playerUid: 7,
				port: gamePort,
				steamId: '76561198000000000',
				token: 'ephemeral-token',
			}),
	})
	const host = new TotwLobbyHost({
		assetPollMs: 60_000,
		brokerToken: 'b'.repeat(32),
		brokerUrl: `http://127.0.0.1:${broker.port}`,
		reconnectMaxMs: 5_000,
		roundTimeSeconds: 900,
	})
	const running = host.run()
	try {
		await withTimeout(levelDataSent)
		await host.stop()
		await withTimeout(running)
		expect(setJoinId).toHaveBeenCalledWith('totw', 'managed-room')
		expect(sentPacketIds[0]).toBe(ZEEPKIST_PACKET_ID.levelLoaded)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.skipToLevel)
		expect(sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)).toBeLessThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.skipToLevel),
		)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.levelData)
		expect(sentPacketIds.lastIndexOf(ZEEPKIST_PACKET_ID.levelLoaded)).toBeGreaterThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.levelData),
		)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyVisibility)
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = blockedFetch
	}
})

function initialStatePacket() {
	return packet(ZEEPKIST_PACKET_ID.initialState, (writer) => {
		writer.writeInt32(1)
		writer.writeUInt32(7)
		writer.writeUInt64(76561198000000000n)
		writer.writeString('tag')
		writer.writeString('name')
		writer.writeBoolean(true)
		writer.writeString('{}')
		for (let index = 0; index < 10; index++) writer.writeFloat32(0)
		writer.writeBoolean(false)
		writer.writeBoolean(false)
		writer.writeByte(0)
		for (let index = 0; index < 13; index++) writer.writeBoolean(false)
		writer.writeInt32(0)
		writer.writeInt32(0)
		writer.writeBoolean(false)
	})
}

function levelRequestPacket() {
	return packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(3)
		writer.writeString('')
		writer.writeString('uid')
		writer.writeUInt64(123n)
		writer.writeInt32(0)
	})
}

function packet(id: number, write: (writer: BitWriter) => void) {
	const writer = new BitWriter()
	writer.writeUInt16(id)
	write(writer)
	return writer.toUint8Array()
}

function connectResponse() {
	const writer = new BitWriter()
	writer.writeString('GameServer')
	writer.writeInt64(0n)
	writer.writeFloat32(0)
	return message(132, writer.toUint8Array(), writer.bitLength)
}

function reliable(payload: Uint8Array, sequence: number) {
	return message(67, payload, payload.length * 8, sequence)
}

function acknowledgement(reliableMessage: Uint8Array) {
	const sequence = (((reliableMessage[1] ?? 0) >>> 1) | ((reliableMessage[2] ?? 0) << 7)) & 1023
	return message(134, Uint8Array.of(67, sequence & 0xff, sequence >>> 8), 24)
}

function message(type: number, payload: Uint8Array, payloadBits: number, sequence = 0) {
	const data = new Uint8Array(5 + payload.length)
	data[0] = type
	data[1] = (sequence << 1) & 0xff
	data[2] = sequence >>> 7
	data[3] = payloadBits & 0xff
	data[4] = payloadBits >>> 8
	data.set(payload, 5)
	return data
}

function bind(server: ReturnType<typeof dgram.createSocket>) {
	return new Promise<number>((resolve) => {
		server.bind(0, '127.0.0.1', () => resolve(server.address().port))
	})
}

function close(server: ReturnType<typeof dgram.createSocket>) {
	return new Promise<void>((resolve) => server.close(() => resolve()))
}

function withTimeout<T>(promise: Promise<T>) {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Test timed out')), 2_000),
		),
	])
}
