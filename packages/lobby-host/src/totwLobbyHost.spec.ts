import { beforeEach, expect, mock, test } from 'bun:test'
import dgram from 'node:dgram'
import {
	BitReader,
	BitWriter,
	encodeZeepkistLevelPayload,
	ZEEPKIST_PACKET_ID,
} from '@zeepkist/core/zeepnet'

interface TestLevel {
	author: string
	collaborators: string
	name: string
	overrideAuthorName: string
	uid: string
	workshopId: bigint
}

const TEST_LEVEL: TestLevel = {
	author: 'Author',
	collaborators: '',
	name: 'Track',
	overrideAuthorName: '',
	uid: 'uid',
	workshopId: 123n,
}
const REPLACEMENT_LEVEL: TestLevel = {
	...TEST_LEVEL,
	name: 'Replacement Track',
	uid: 'uid-2',
	workshopId: 124n,
}

function sha256(value: string | Uint8Array): string {
	return new Bun.CryptoHasher('sha256').update(value).digest('hex')
}

const preparedPayload = makePayload('initial')
const replacementPayload = makePayload('replacement')
const initialAsset = assetMetadata(42, TEST_LEVEL, preparedPayload, 'private/asset.gz')
const replacementAsset = assetMetadata(
	43,
	REPLACEMENT_LEVEL,
	replacementPayload,
	'private/replacement.gz',
)
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
	getJoinId.mockClear()
	setJoinId.mockClear()
	clearJoinId.mockClear()
	getAsset.mockClear()
})

test('matches C# playlist transition and serves every level-data request', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const sentPacketIds: number[] = []
	let incomingSequence = 0
	let playlistSequence: number | undefined
	let skipSequence: number | undefined
	let connectedAt = 0
	let playlistSentAt = 0
	let responseCount = 0
	let resolveResponses: (() => void) | undefined
	const responsesComplete = new Promise<void>((resolve) => {
		resolveResponses = resolve
	})

	gameServer.on('message', (data, remote) => {
		if (data[0] === 131) connectedAt = performance.now()
		if (handleConnect(gameServer, data, remote)) return
		if (data[0] !== 67) return
		gameServer.send(acknowledgement(data), remote.port, remote.address)
		const messageSequence = reliableSequence(data)
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const reader = new BitReader(payload)
		const packetId = reader.readUInt16()
		sentPacketIds.push(packetId)

		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			playlistSentAt = performance.now()
			playlistSequence = messageSequence
			expect(readPlaylist(reader)).toEqual({ level: TEST_LEVEL, roundTime: 900 })
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			skipSequence = messageSequence
			expect(reader.readString()).toBe(TEST_LEVEL.uid)
			expect(reader.readUInt64()).toBe(TEST_LEVEL.workshopId)
			for (let duplicate = 0; duplicate < 2; duplicate++) {
				gameServer.send(
					reliable(
						levelRequestPacket('Requested Track Name', TEST_LEVEL),
						incomingSequence++,
					),
					remote.port,
					remote.address,
				)
			}
			return
		}
		if (packetId !== ZEEPKIST_PACKET_ID.levelData) return
		const response = readLevelResponse(reader)
		expect(response.data).toEqual(preparedPayload)
		expect(response.uid).toBe(TEST_LEVEL.uid)
		expect(response.workshopId).toBe(TEST_LEVEL.workshopId)
		responseCount++
		if (responseCount < 3) expect(response.name).toBe('Requested Track Name')
		if (responseCount === 2) {
			gameServer.send(
				reliable(levelRequestPacket('Late Join Name', TEST_LEVEL), incomingSequence++),
				remote.port,
				remote.address,
			)
		} else if (responseCount === 3) {
			expect(response.name).toBe('Late Join Name')
			resolveResponses?.()
		}
	})

	const broker = startBroker(gamePort)
	const host = createHost(requiredPort(broker.port), 500, 40)
	const running = host.run()
	try {
		await withTimeout(responsesComplete)
		await host.stop()
		await withTimeout(running)
		expect(setJoinId).toHaveBeenCalledWith('totw', 'managed-room')
		expect(sentPacketIds.slice(0, 2)).toEqual([
			ZEEPKIST_PACKET_ID.changeLobbyPlaylist,
			ZEEPKIST_PACKET_ID.skipToLevel,
		])
		expect(skipSequence).toBe(((playlistSequence ?? -1) + 1) & 1023)
		expect(playlistSentAt - connectedAt).toBeGreaterThanOrEqual(35)
		expect(
			sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelData),
		).toHaveLength(3)
		expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelLoaded)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyVisibility)
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = originalFetch
	}
})

test('switches weekly asset and retains previous payload during handoff', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const playlistUids: string[] = []
	let incomingSequence = 0
	let initialResponses = 0
	let resolveComplete: (() => void) | undefined
	const complete = new Promise<void>((resolve) => {
		resolveComplete = resolve
	})

	gameServer.on('message', (data, remote) => {
		if (handleConnect(gameServer, data, remote)) return
		if (data[0] !== 67) return
		gameServer.send(acknowledgement(data), remote.port, remote.address)
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const reader = new BitReader(payload)
		const packetId = reader.readUInt16()
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			const playlist = readPlaylist(reader)
			playlistUids.push(playlist.level.uid)
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			const uid = reader.readString()
			const workshopId = reader.readUInt64()
			const level = uid === TEST_LEVEL.uid ? TEST_LEVEL : REPLACEMENT_LEVEL
			expect(workshopId).toBe(level.workshopId)
			gameServer.send(
				reliable(levelRequestPacket(`Requested ${uid}`, level), incomingSequence++),
				remote.port,
				remote.address,
			)
			return
		}
		if (packetId !== ZEEPKIST_PACKET_ID.levelData) return
		const response = readLevelResponse(reader)
		if (response.uid === TEST_LEVEL.uid) {
			expect(response.data).toEqual(preparedPayload)
			initialResponses++
			if (initialResponses === 1) {
				downloadedPayload = replacementPayload
				preferredAsset = replacementAsset
			} else {
				expect(response.name).toBe('Previous Level Retry')
				resolveComplete?.()
			}
			return
		}
		expect(response).toEqual({
			data: replacementPayload,
			name: `Requested ${REPLACEMENT_LEVEL.uid}`,
			uid: REPLACEMENT_LEVEL.uid,
			workshopId: REPLACEMENT_LEVEL.workshopId,
		})
		gameServer.send(
			reliable(levelRequestPacket('Previous Level Retry', TEST_LEVEL), incomingSequence++),
			remote.port,
			remote.address,
		)
	})

	const broker = startBroker(gamePort)
	const host = createHost(requiredPort(broker.port), 500, 0, 20)
	const running = host.run()
	try {
		await withTimeout(complete)
		await host.stop()
		await withTimeout(running)
		expect(playlistUids).toEqual([TEST_LEVEL.uid, REPLACEMENT_LEVEL.uid])
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = originalFetch
	}
})

test('reconnects when GameServer never requests level data', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const sentPacketIds: number[] = []
	let assignmentRequests = 0
	let resolveReconnect: (() => void) | undefined
	const reconnected = new Promise<void>((resolve) => {
		resolveReconnect = resolve
	})
	gameServer.on('message', (data, remote) => {
		if (handleConnect(gameServer, data, remote)) return
		if (data[0] !== 67) return
		gameServer.send(acknowledgement(data), remote.port, remote.address)
		const payload = receiveReliablePayload(data, fragments)
		if (payload) sentPacketIds.push(new BitReader(payload).readUInt16())
	})
	const broker = startBroker(gamePort, () => {
		assignmentRequests++
		if (assignmentRequests === 2) resolveReconnect?.()
	})
	const host = createHost(requiredPort(broker.port), 25, 0)
	const running = host.run()
	try {
		await withTimeout(reconnected)
		await host.stop()
		await withTimeout(running)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.skipToLevel)
		expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelData)
		expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelLoaded)
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = originalFetch
	}
})

test('refreshes GameServer credential without resetting playlist', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const tokens = new Map<number, string>()
	const established = new Set<number>()
	let playlistPackets = 0
	let oldPort = 0
	let successorPort = 0
	let resolveHandoff: (() => void) | undefined
	const handoff = new Promise<void>((resolve) => {
		resolveHandoff = resolve
	})
	gameServer.on('message', (data, remote) => {
		if (data[0] === 131) {
			const reader = new BitReader(data.subarray(5))
			expect(reader.readString()).toBe('GameServer')
			reader.readInt64()
			reader.readFloat32()
			const token = reader.readString()
			tokens.set(remote.port, token)
			if (token === 'ephemeral-token-1') oldPort = remote.port
			if (token === 'ephemeral-token-2') successorPort = remote.port
			gameServer.send(connectResponse(), remote.port, remote.address)
			return
		}
		if (data[0] === 133 && !established.has(remote.port)) {
			established.add(remote.port)
			const playerUid = tokens.get(remote.port) === 'ephemeral-token-2' ? 8 : 7
			gameServer.send(
				reliable(initialStatePacket(playerUid, 76561198000000000n), 0),
				remote.port,
				remote.address,
			)
			return
		}
		if (data[0] === 135) {
			if (remote.port === oldPort && successorPort !== 0) resolveHandoff?.()
			return
		}
		if (data[0] !== 67) return
		gameServer.send(acknowledgement(data), remote.port, remote.address)
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const reader = new BitReader(payload)
		const packetId = reader.readUInt16()
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			playlistPackets++
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			gameServer.send(
				reliable(levelRequestPacket('Requested Track', TEST_LEVEL), 1),
				remote.port,
				remote.address,
			)
		}
	})

	const issuedAt = Date.now()
	const broker = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: (request) => {
			const generation = new URL(request.url).pathname.endsWith('/credential') ? 2 : 1
			const generationIssuedAt = generation === 1 ? issuedAt : Date.now()
			return Response.json({
				credentialDeadlineAt: generationIssuedAt + 60_000,
				credentialGeneration: generation,
				credentialIssuedAt: generationIssuedAt,
				credentialRefreshAt: generationIssuedAt + (generation === 1 ? 500 : 30_000),
				host: '127.0.0.1',
				joinId: 'managed-room',
				playerUid: generation === 1 ? 7 : 8,
				port: gamePort,
				steamId: '76561198000000000',
				token: `ephemeral-token-${generation}`,
			})
		},
	})
	const host = createHost(requiredPort(broker.port), 1_000, 0)
	const running = host.run()
	try {
		await withTimeout(handoff)
		expect([...tokens.values()]).toEqual(['ephemeral-token-1', 'ephemeral-token-2'])
		expect(playlistPackets).toBe(1)
		await host.stop()
		await withTimeout(running)
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = originalFetch
	}
})

function createHost(
	brokerPort: number,
	protocolTimeoutMs: number,
	playlistDelayMs: number,
	assetPollMs = 60_000,
) {
	return new TotwLobbyHost(
		{
			assetPollMs,
			brokerToken: 'b'.repeat(32),
			brokerUrl: `http://127.0.0.1:${brokerPort}`,
			reconnectMaxMs: 5_000,
			roundTimeSeconds: 900,
		},
		protocolTimeoutMs,
		playlistDelayMs,
	)
}

function requiredPort(port: number | undefined) {
	if (!port) throw new Error('Test server port unavailable')
	return port
}

function startBroker(gamePort: number, onRequest?: () => void) {
	return Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: () => {
			onRequest?.()
			return Response.json({
				host: '127.0.0.1',
				joinId: 'managed-room',
				playerUid: 7,
				port: gamePort,
				steamId: '76561198000000000',
				token: 'ephemeral-token',
			})
		},
	})
}

function handleConnect(
	server: ReturnType<typeof dgram.createSocket>,
	data: Uint8Array,
	remote: { address: string; port: number },
) {
	if (data[0] === 131) {
		const reader = new BitReader(data.subarray(5))
		expect(reader.readString()).toBe('GameServer')
		reader.readInt64()
		reader.readFloat32()
		expect(reader.readString()).toBe('ephemeral-token')
		server.send(connectResponse(), remote.port, remote.address)
		return true
	}
	return data[0] === 133
}

function readPlaylist(reader: BitReader) {
	const roundTime = reader.readFloat64()
	expect(reader.readBoolean()).toBe(false)
	expect(reader.readInt32()).toBe(0)
	expect(reader.readInt32()).toBe(0)
	expect(reader.readInt32()).toBe(1)
	const level = {
		uid: reader.readString(),
		workshopId: reader.readUInt64(),
		name: reader.readString(),
		collaborators: reader.readString(),
		overrideAuthorName: reader.readString(),
		author: reader.readString(),
	}
	expect(reader.readBoolean()).toBe(false)
	expect(reader.readBoolean()).toBe(true)
	expect(reader.readInt32()).toBe(1)
	return { level, roundTime }
}

function readLevelResponse(reader: BitReader) {
	expect(reader.readInt32()).toBe(2)
	const name = reader.readString()
	const uid = reader.readString()
	const workshopId = reader.readUInt64()
	const byteLength = reader.readInt32()
	return { data: reader.readBytes(byteLength), name, uid, workshopId }
}

function levelRequestPacket(name: string, level: TestLevel) {
	return packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(3)
		writer.writeString(name)
		writer.writeString(level.uid)
		writer.writeUInt64(level.workshopId)
		writer.writeInt32(0)
	})
}

function initialStatePacket(playerUid: number, steamId: bigint) {
	return packet(ZEEPKIST_PACKET_ID.initialState, (writer) => {
		writer.writeInt32(1)
		writer.writeUInt32(playerUid)
		writer.writeUInt64(steamId)
		writer.writeString('Managed host')
		writer.writeString('')
		writer.writeBoolean(true)
		writer.writeString('')
		for (let value = 0; value < 10; value++) writer.writeFloat32(0)
		writer.writeBoolean(false)
		writer.writeBoolean(false)
		writer.writeByte(0)
		for (let value = 0; value < 13; value++) writer.writeBoolean(false)
		writer.writeInt32(0)
		writer.writeInt32(0)
		writer.writeBoolean(false)
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
	const sequence = reliableSequence(reliableMessage)
	return message(134, Uint8Array.of(67, sequence & 0xff, sequence >>> 8), 24)
}

function reliableSequence(data: Uint8Array) {
	return (((data[1] ?? 0) >>> 1) | ((data[2] ?? 0) << 7)) & 1023
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

function makePayload(seed: string) {
	return encodeZeepkistLevelPayload(
		Array.from({ length: 512 }, (_, index) => sha256(`${seed}-${index}`)).join('\n'),
		true,
	)
}

function assetMetadata(
	idTournament: number,
	level: TestLevel,
	payload: Uint8Array,
	objectKey: string,
) {
	return {
		idTournament,
		workshopId: level.workshopId,
		fileUid: level.uid,
		levelName: level.name,
		author: level.author,
		collaborators: level.collaborators,
		overrideAuthorName: level.overrideAuthorName,
		objectKey,
		contentSha256: sha256(payload),
		byteSize: payload.length,
	}
}
