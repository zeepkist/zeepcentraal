import { beforeEach, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
import dgram from 'node:dgram'
import {
	BitReader,
	BitWriter,
	encodeZeepkistLevelPayload,
	ZEEPKIST_PACKET_ID,
} from '@zeepkist/core/zeepnet'

const preparedPayload = encodeZeepkistLevelPayload(
	Array.from({ length: 512 }, (_, index) =>
		createHash('sha256').update(index.toString()).digest('hex'),
	).join('\n'),
	true,
)
const replacementPayload = encodeZeepkistLevelPayload(
	Array.from({ length: 512 }, (_, index) =>
		createHash('sha256').update(`replacement-${index}`).digest('hex'),
	).join('\n'),
	true,
)
const initialAsset = {
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
}
let preferredAsset = initialAsset
let downloadedPayload: Uint8Array = preparedPayload
const getJoinId = mock(async () => undefined)
const setJoinId = mock(async () => {})
const clearJoinId = mock(async () => {})
const getAsset = mock(async () => preferredAsset)

mock.module('@zeepkist/database', () => ({
	clearManagedLobbyJoinId: clearJoinId,
	downloadTrackTournamentLobbyAsset: async () => downloadedPayload,
	getManagedLobbyJoinId: getJoinId,
	getPreferredTrackTournamentLobbyAsset: getAsset,
	setManagedLobbyJoinId: setJoinId,
}))

const { TotwLobbyHost } = await import('./totwLobbyHost')

beforeEach(() => {
	preferredAsset = initialAsset
	downloadedPayload = preparedPayload
})

test('hosts looping playlist, supplies level data, and privatizes on shutdown', async () => {
	const blockedFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const sentPacketIds: number[] = []
	const fragments = new Map<number, FragmentGroup>()
	let resolveLevelData: (() => void) | undefined
	const levelDataSent = new Promise<void>((resolve) => {
		resolveLevelData = resolve
	})
	let incomingSequence = 0
	let levelEchoSent = false
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
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const reader = new BitReader(payload)
		const packetId = reader.readUInt16()
		sentPacketIds.push(packetId)
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			for (let duplicate = 0; duplicate < 2; duplicate++)
				gameServer.send(
					reliable(levelRequestPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelData) {
			expect(reader.readInt32()).toBe(2)
			expect(reader.readString()).toBe('Track')
			expect(reader.readString()).toBe('uid')
			expect(reader.readUInt64()).toBe(123n)
			const byteLength = reader.readInt32()
			expect(byteLength).toBe(preparedPayload.length)
			expect(byteLength).toBeGreaterThan(1_200)
			expect(reader.readBytes(byteLength)).toEqual(preparedPayload)
			levelEchoSent = true
			const echoFragments = reliableFragments(levelDataEchoPacket(), incomingSequence)
			incomingSequence = echoFragments.nextSequence
			for (const fragment of echoFragments.messages)
				gameServer.send(fragment, remote.port, remote.address)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelLoaded) {
			expect(levelEchoSent).toBe(true)
			resolveLevelData?.()
		}
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
		expect(sentPacketIds[0]).toBe(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.skipToLevel)
		expect(sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)).toBeLessThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.skipToLevel),
		)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.levelData)
		expect(
			sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelData),
		).toHaveLength(1)
		expect(sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.levelLoaded)).toBeGreaterThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.levelData),
		)
		expect(
			sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelLoaded),
		).toHaveLength(1)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyVisibility)
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = blockedFetch
	}
})

test('switches to newly prepared weekly asset through the complete load handshake', async () => {
	const blockedFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const playlistUids: string[] = []
	let incomingSequence = 0
	let loadedCount = 0
	let resolveReplacement: (() => void) | undefined
	const replacementLoaded = new Promise<void>((resolve) => {
		resolveReplacement = resolve
	})
	gameServer.on('message', (data, remote) => {
		if (data[0] === 131) {
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
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const reader = new BitReader(payload)
		const packetId = reader.readUInt16()
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			reader.readFloat64()
			reader.readBoolean()
			reader.readInt32()
			reader.readInt32()
			expect(reader.readInt32()).toBe(1)
			playlistUids.push(reader.readString())
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			const uid = reader.readString()
			const workshopId = reader.readUInt64()
			gameServer.send(
				reliable(levelRequestPacket(uid, workshopId), incomingSequence++),
				remote.port,
				remote.address,
			)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelData) {
			expect(reader.readInt32()).toBe(2)
			const name = reader.readString()
			const uid = reader.readString()
			const workshopId = reader.readUInt64()
			const byteLength = reader.readInt32()
			const levelData = reader.readBytes(byteLength)
			const echoFragments = reliableFragments(
				levelDataEchoPacket(levelData, { name, uid, workshopId }),
				incomingSequence,
			)
			incomingSequence = echoFragments.nextSequence
			for (const fragment of echoFragments.messages)
				gameServer.send(fragment, remote.port, remote.address)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelLoaded) {
			loadedCount++
			if (loadedCount === 1) {
				downloadedPayload = replacementPayload
				preferredAsset = {
					...initialAsset,
					idTournament: 43,
					workshopId: 124n,
					fileUid: 'uid-2',
					levelName: 'Replacement Track',
					objectKey: 'private/replacement.gz',
					contentSha256: createHash('sha256').update(replacementPayload).digest('hex'),
					byteSize: replacementPayload.length,
				}
			} else if (loadedCount === 2) {
				resolveReplacement?.()
			}
		}
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
		assetPollMs: 25,
		brokerToken: 'b'.repeat(32),
		brokerUrl: `http://127.0.0.1:${broker.port}`,
		reconnectMaxMs: 5_000,
		roundTimeSeconds: 900,
	})
	const running = host.run()
	try {
		await withTimeout(replacementLoaded)
		await host.stop()
		await withTimeout(running)
		expect(playlistUids).toEqual(['uid', 'uid-2'])
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = blockedFetch
	}
})

test('disconnects without acknowledging corrupted echoed level data', async () => {
	const corruptedPayload = Buffer.from(preparedPayload)
	corruptedPayload[0] = (corruptedPayload[0] ?? 0) ^ 0xff
	const sentPacketIds = await runFailedLevelTransfer(corruptedPayload, 1_000)
	expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelLoaded)
})

test('disconnects without acknowledging when level data echo times out', async () => {
	const sentPacketIds = await runFailedLevelTransfer(undefined, 25)
	expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelLoaded)
})

async function runFailedLevelTransfer(echoData: Uint8Array | undefined, echoTimeoutMs: number) {
	const blockedFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const sentPacketIds: number[] = []
	let incomingSequence = 0
	let resolveDisconnect: (() => void) | undefined
	const disconnected = new Promise<void>((resolve) => {
		resolveDisconnect = resolve
	})
	gameServer.on('message', (data, remote) => {
		if (data[0] === 131) {
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
		if (data[0] === 135) {
			resolveDisconnect?.()
			return
		}
		if (data[0] !== 67) return
		gameServer.send(acknowledgement(data), remote.port, remote.address)
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const packetId = new BitReader(payload).readUInt16()
		sentPacketIds.push(packetId)
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			gameServer.send(
				reliable(levelRequestPacket(), incomingSequence++),
				remote.port,
				remote.address,
			)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelData && echoData) {
			const echoFragments = reliableFragments(levelDataEchoPacket(echoData), incomingSequence)
			incomingSequence = echoFragments.nextSequence
			for (const fragment of echoFragments.messages)
				gameServer.send(fragment, remote.port, remote.address)
		}
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
	const host = new TotwLobbyHost(
		{
			assetPollMs: 60_000,
			brokerToken: 'b'.repeat(32),
			brokerUrl: `http://127.0.0.1:${broker.port}`,
			reconnectMaxMs: 5_000,
			roundTimeSeconds: 900,
		},
		echoTimeoutMs,
	)
	const running = host.run()
	try {
		await withTimeout(disconnected)
		await host.stop()
		await withTimeout(running)
		return sentPacketIds
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = blockedFetch
	}
}

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

function levelRequestPacket(uid = 'uid', workshopId = 123n) {
	return packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(3)
		writer.writeString('')
		writer.writeString(uid)
		writer.writeUInt64(workshopId)
		writer.writeInt32(0)
	})
}

function levelDataEchoPacket(
	data: Uint8Array = preparedPayload,
	level: { name: string; uid: string; workshopId: bigint } = {
		name: 'Track',
		uid: 'uid',
		workshopId: 123n,
	},
) {
	return packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(1)
		writer.writeString(level.name)
		writer.writeString(level.uid)
		writer.writeUInt64(level.workshopId)
		writer.writeInt32(data.length)
		writer.writeBytes(data)
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

function reliableFragments(payload: Uint8Array, firstSequence: number) {
	const chunkByteSize = 1_000
	const messages: Uint8Array[] = []
	let sequence = firstSequence
	for (let offset = 0, chunkNumber = 0; offset < payload.length; chunkNumber++) {
		const chunk = payload.subarray(offset, offset + chunkByteSize)
		const fragment = new BitWriter()
		fragment.writeVariableUInt32(1)
		fragment.writeVariableUInt32(payload.length * 8)
		fragment.writeVariableUInt32(chunkByteSize)
		fragment.writeVariableUInt32(chunkNumber)
		fragment.writeBytes(chunk)
		messages.push(message(67, fragment.toUint8Array(), fragment.bitLength, sequence, true))
		sequence = (sequence + 1) % 1024
		offset += chunk.length
	}
	return { messages, nextSequence: sequence }
}

function acknowledgement(reliableMessage: Uint8Array) {
	const sequence = (((reliableMessage[1] ?? 0) >>> 1) | ((reliableMessage[2] ?? 0) << 7)) & 1023
	return message(134, Uint8Array.of(67, sequence & 0xff, sequence >>> 8), 24)
}

interface FragmentGroup {
	chunkByteSize: number
	chunks: Map<number, Uint8Array>
	totalBytes: number
}

function receiveReliablePayload(message: Uint8Array, fragments: Map<number, FragmentGroup>) {
	if (((message[1] ?? 0) & 1) === 0) return message.subarray(5)
	const reader = new BitReader(message.subarray(5))
	const groupId = reader.readVariableUInt32()
	const totalBits = reader.readVariableUInt32()
	const chunkByteSize = reader.readVariableUInt32()
	const chunkNumber = reader.readVariableUInt32()
	const totalBytes = Math.ceil(totalBits / 8)
	const expectedBytes = Math.min(chunkByteSize, totalBytes - chunkNumber * chunkByteSize)
	const group = fragments.get(groupId) ?? {
		chunkByteSize,
		chunks: new Map<number, Uint8Array>(),
		totalBytes,
	}
	expect(group.chunkByteSize).toBe(chunkByteSize)
	expect(group.totalBytes).toBe(totalBytes)
	group.chunks.set(chunkNumber, reader.readBytes(expectedBytes))
	fragments.set(groupId, group)
	const chunkCount = Math.ceil(totalBytes / chunkByteSize)
	if (group.chunks.size !== chunkCount) return undefined
	const payload = new Uint8Array(totalBytes)
	for (let index = 0; index < chunkCount; index++) {
		const chunk = group.chunks.get(index)
		expect(chunk).toBeDefined()
		if (chunk) payload.set(chunk, index * chunkByteSize)
	}
	fragments.delete(groupId)
	return payload
}

function message(
	type: number,
	payload: Uint8Array,
	payloadBits: number,
	sequence = 0,
	fragmented = false,
) {
	const data = new Uint8Array(5 + payload.length)
	data[0] = type
	data[1] = ((sequence << 1) | (fragmented ? 1 : 0)) & 0xff
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
			setTimeout(() => reject(new Error('Test timed out')), 5_000),
		),
	])
}
