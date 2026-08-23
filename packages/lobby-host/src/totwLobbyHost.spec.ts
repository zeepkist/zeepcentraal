import { beforeEach, expect, mock, test } from 'bun:test'
import { createHash } from 'node:crypto'
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
const DEFAULT_LEVEL: TestLevel = {
	author: 'Yannic',
	collaborators: '',
	name: 'Level A-01',
	overrideAuthorName: '',
	uid: 'ea1',
	workshopId: 0n,
}

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
	let initialReady = false
	let postReadinessSynced = false
	let customPlaylistCount = 0
	let gamePropertiesSent = false
	let levelDataReturned = false
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
			gameServer.send(
				reliable(playlistPacket(DEFAULT_LEVEL, 480), incomingSequence++),
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
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			if (!postReadinessSynced) return
			const level = readPlaylistLevel(reader)
			expect(level.uid).toBe('uid')
			customPlaylistCount++
			if (customPlaylistCount === 1) {
				gameServer.send(
					reliable(playlistPacket(TEST_LEVEL, 900), incomingSequence++),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(playlistIndexPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
			}
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			if (!initialReady || customPlaylistCount !== 2) return
			for (let duplicate = 0; duplicate < 2; duplicate++)
				gameServer.send(
					reliable(levelRequestPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelData) {
			const packetType = reader.readInt32()
			if (packetType === 2) {
				expect(reader.readString()).toBe('Track')
				expect(reader.readString()).toBe('uid')
				expect(reader.readUInt64()).toBe(123n)
				const byteLength = reader.readInt32()
				expect(byteLength).toBe(preparedPayload.length)
				expect(byteLength).toBeGreaterThan(1_200)
				expect(reader.readBytes(byteLength)).toEqual(preparedPayload)
				gamePropertiesSent = true
				gameServer.send(
					reliable(gamePropertiesPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
			} else {
				expect(packetType).toBe(0)
				expect(reader.readString()).toBe('')
				expect(reader.readString()).toBe('')
				expect(reader.readUInt64()).toBe(0n)
				expect(reader.readInt32()).toBe(0)
				levelDataReturned = true
				incomingSequence = sendReliablePayload(
					gameServer,
					levelResponsePacket('Track', preparedPayload),
					remote,
					incomingSequence,
				)
			}
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelLoaded) {
			if (!initialReady) {
				initialReady = true
				setTimeout(() => {
					postReadinessSynced = true
					gameServer.send(
						reliable(playlistPacket(DEFAULT_LEVEL, 480), incomingSequence++),
						remote.port,
						remote.address,
					)
				}, 5)
				return
			}
			expect(gamePropertiesSent).toBe(true)
			expect(levelDataReturned).toBe(true)
			gameServer.send(
				reliable(playlistPacket(TEST_LEVEL, 900), incomingSequence++),
				remote.port,
				remote.address,
			)
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
		const loadedIndices = sentPacketIds.flatMap((packetId, index) =>
			packetId === ZEEPKIST_PACKET_ID.levelLoaded ? [index] : [],
		)
		expect(sentPacketIds[0]).toBe(ZEEPKIST_PACKET_ID.levelLoaded)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.skipToLevel)
		expect(loadedIndices[0]).toBeLessThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.changeLobbyPlaylist),
		)
		expect(sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.changeLobbyPlaylist)).toBeLessThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.skipToLevel),
		)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.levelData)
		expect(
			sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelData),
		).toHaveLength(2)
		expect(loadedIndices[1]).toBeGreaterThan(
			sentPacketIds.indexOf(ZEEPKIST_PACKET_ID.levelData),
		)
		expect(loadedIndices).toHaveLength(2)
		expect(sentPacketIds.slice(0, 7)).toEqual([
			ZEEPKIST_PACKET_ID.levelLoaded,
			ZEEPKIST_PACKET_ID.changeLobbyPlaylist,
			ZEEPKIST_PACKET_ID.changeLobbyPlaylist,
			ZEEPKIST_PACKET_ID.skipToLevel,
			ZEEPKIST_PACKET_ID.levelData,
			ZEEPKIST_PACKET_ID.levelData,
			ZEEPKIST_PACKET_ID.levelLoaded,
		])
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
	let initialReady = false
	let postReadinessSynced = false
	const playlistCounts = new Map<string, number>()
	let transferAwaitingLoaded: { data: Uint8Array; level: typeof TEST_LEVEL } | undefined
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
			gameServer.send(
				reliable(playlistPacket(DEFAULT_LEVEL, 480), incomingSequence++),
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
			if (!postReadinessSynced) return
			const level = readPlaylistLevel(reader)
			playlistUids.push(level.uid)
			const count = (playlistCounts.get(level.uid) ?? 0) + 1
			playlistCounts.set(level.uid, count)
			if (count === 1) {
				gameServer.send(
					reliable(playlistPacket(level, 900), incomingSequence++),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(playlistIndexPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
			}
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			if (!initialReady) return
			const uid = reader.readString()
			const workshopId = reader.readUInt64()
			if ((playlistCounts.get(uid) ?? 0) < 2) return
			gameServer.send(
				reliable(levelRequestPacket(uid, workshopId), incomingSequence++),
				remote.port,
				remote.address,
			)
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelData) {
			const packetType = reader.readInt32()
			if (packetType === 2) {
				const name = reader.readString()
				const uid = reader.readString()
				const workshopId = reader.readUInt64()
				const byteLength = reader.readInt32()
				const levelData = reader.readBytes(byteLength)
				transferAwaitingLoaded = {
					data: levelData,
					level: {
						author: 'Author',
						collaborators: '',
						name,
						overrideAuthorName: '',
						uid,
						workshopId,
					},
				}
				gameServer.send(
					reliable(gamePropertiesPacket(uid, workshopId), incomingSequence++),
					remote.port,
					remote.address,
				)
			} else if (packetType === 0 && transferAwaitingLoaded) {
				incomingSequence = sendReliablePayload(
					gameServer,
					levelResponsePacket(
						transferAwaitingLoaded.level.name,
						transferAwaitingLoaded.data,
					),
					remote,
					incomingSequence,
				)
			}
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelLoaded) {
			if (!initialReady) {
				initialReady = true
				setTimeout(() => {
					postReadinessSynced = true
					gameServer.send(
						reliable(playlistPacket(DEFAULT_LEVEL, 480), incomingSequence++),
						remote.port,
						remote.address,
					)
				}, 5)
				return
			}
			if (!transferAwaitingLoaded) return
			gameServer.send(
				reliable(playlistPacket(transferAwaitingLoaded.level, 900), incomingSequence++),
				remote.port,
				remote.address,
			)
			transferAwaitingLoaded = undefined
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
		expect(playlistUids).toEqual(['uid', 'uid', 'uid-2', 'uid-2'])
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = blockedFetch
	}
})

test('disconnects without final acknowledgement for mismatched game properties', async () => {
	const sentPacketIds = await runFailedLevelTransfer(
		{ properties: { uid: 'wrong-uid', workshopId: 999n } },
		25,
	)
	expect(
		sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelLoaded),
	).toHaveLength(1)
})

test('disconnects without final acknowledgement when game properties time out', async () => {
	const sentPacketIds = await runFailedLevelTransfer({}, 25)
	expect(
		sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelLoaded),
	).toHaveLength(1)
})

test('disconnects without final acknowledgement for mismatched returned level data', async () => {
	const corruptPayload = Uint8Array.from(preparedPayload)
	corruptPayload[0] = (corruptPayload[0] ?? 0) ^ 0xff
	const sentPacketIds = await runFailedLevelTransfer(
		{
			properties: { uid: 'uid', workshopId: 123n },
			response: { data: corruptPayload, name: 'Track' },
		},
		25,
	)
	expect(
		sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelLoaded),
	).toHaveLength(1)
})

test('disconnects when the GameServer never requests level data', async () => {
	const sentPacketIds = await runFailedLevelTransfer({ sendLevelRequest: false }, 25)
	expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelData)
	expect(
		sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelLoaded),
	).toHaveLength(1)
})

interface FailedTransferOptions {
	properties?: { uid: string; workshopId: bigint }
	response?: { data: Uint8Array; name: string }
	sendLevelRequest?: boolean
}

async function runFailedLevelTransfer(options: FailedTransferOptions, propertiesTimeoutMs: number) {
	const blockedFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const sentPacketIds: number[] = []
	let incomingSequence = 0
	let initialReady = false
	let postReadinessSynced = false
	let customPlaylistCount = 0
	let assignmentRequests = 0
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
			gameServer.send(
				reliable(playlistPacket(DEFAULT_LEVEL, 480), incomingSequence++),
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
		const reader = new BitReader(payload)
		const packetId = reader.readUInt16()
		sentPacketIds.push(packetId)
		if (packetId === ZEEPKIST_PACKET_ID.levelLoaded && !initialReady) {
			initialReady = true
			setTimeout(() => {
				postReadinessSynced = true
				gameServer.send(
					reliable(playlistPacket(DEFAULT_LEVEL, 480), incomingSequence++),
					remote.port,
					remote.address,
				)
			}, 5)
		}
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyPlaylist) {
			if (!postReadinessSynced) return
			readPlaylistLevel(reader)
			customPlaylistCount++
			if (customPlaylistCount === 1) {
				gameServer.send(
					reliable(playlistPacket(TEST_LEVEL, 900), incomingSequence++),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(playlistIndexPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
			}
		}
		if (packetId === ZEEPKIST_PACKET_ID.skipToLevel) {
			if (!initialReady || customPlaylistCount !== 2 || options.sendLevelRequest === false)
				return
			gameServer.send(
				reliable(levelRequestPacket(), incomingSequence++),
				remote.port,
				remote.address,
			)
		}
		if (
			packetId === ZEEPKIST_PACKET_ID.levelData &&
			reader.readInt32() === 2 &&
			options.properties
		) {
			gameServer.send(
				reliable(
					gamePropertiesPacket(options.properties.uid, options.properties.workshopId),
					incomingSequence++,
				),
				remote.port,
				remote.address,
			)
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.levelData && options.response) {
			incomingSequence = sendReliablePayload(
				gameServer,
				levelResponsePacket(options.response.name, options.response.data),
				remote,
				incomingSequence,
			)
		}
	})

	const broker = Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: () => {
			assignmentRequests++
			if (assignmentRequests > 1) resolveDisconnect?.()
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
	const host = new TotwLobbyHost(
		{
			assetPollMs: 60_000,
			brokerToken: 'b'.repeat(32),
			brokerUrl: `http://127.0.0.1:${broker.port}`,
			reconnectMaxMs: 5_000,
			roundTimeSeconds: 900,
		},
		propertiesTimeoutMs,
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

function playlistPacket(level: TestLevel, roundTime: number) {
	return packet(ZEEPKIST_PACKET_ID.changeLobbyPlaylist, (writer) => {
		writer.writeFloat64(roundTime)
		writer.writeBoolean(false)
		writer.writeInt32(0)
		writer.writeInt32(0)
		writer.writeInt32(1)
		writer.writeString(level.uid)
		writer.writeUInt64(level.workshopId)
		writer.writeString(level.name)
		writer.writeString(level.collaborators)
		writer.writeString(level.overrideAuthorName)
		writer.writeString(level.author)
		writer.writeBoolean(true)
		writer.writeBoolean(true)
		writer.writeInt32(1)
	})
}

function readPlaylistLevel(reader: BitReader): TestLevel {
	reader.readFloat64()
	reader.readBoolean()
	reader.readInt32()
	reader.readInt32()
	expect(reader.readInt32()).toBe(1)
	const level = {
		uid: reader.readString(),
		workshopId: reader.readUInt64(),
		name: reader.readString(),
		collaborators: reader.readString(),
		overrideAuthorName: reader.readString(),
		author: reader.readString(),
	}
	expect(reader.readBoolean()).toBe(true)
	expect(reader.readBoolean()).toBe(true)
	expect(reader.readInt32()).toBe(1)
	return level
}

function playlistIndexPacket() {
	return packet(ZEEPKIST_PACKET_ID.changeLobbyPlaylistIndex, (writer) => {
		writer.writeInt32(0)
		writer.writeInt32(0)
		writer.writeBoolean(false)
	})
}

function levelResponsePacket(name: string, data: Uint8Array) {
	return packet(ZEEPKIST_PACKET_ID.levelData, (writer) => {
		writer.writeInt32(1)
		writer.writeString(name)
		writer.writeString('')
		writer.writeUInt64(0n)
		writer.writeInt32(data.length)
		writer.writeBytes(data)
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

function gamePropertiesPacket(uid = 'uid', workshopId = 123n) {
	return packet(ZEEPKIST_PACKET_ID.changeLobbyGameProperties, (writer) => {
		writer.writeFloat64(900)
		writer.writeFloat64(123.5)
		writer.writeString(uid)
		writer.writeUInt64(workshopId)
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

function sendReliablePayload(
	server: ReturnType<typeof dgram.createSocket>,
	payload: Uint8Array,
	remote: { address: string; port: number },
	sequence: number,
) {
	const chunkByteSize = 1_000
	if (payload.length <= chunkByteSize) {
		server.send(reliable(payload, sequence), remote.port, remote.address)
		return (sequence + 1) & 1023
	}
	const groupId = sequence + 1
	const chunkCount = Math.ceil(payload.length / chunkByteSize)
	let nextSequence = sequence
	for (let chunkNumber = 0; chunkNumber < chunkCount; chunkNumber++) {
		const start = chunkNumber * chunkByteSize
		const fragment = new BitWriter()
		fragment.writeVariableUInt32(groupId)
		fragment.writeVariableUInt32(payload.length * 8)
		fragment.writeVariableUInt32(chunkByteSize)
		fragment.writeVariableUInt32(chunkNumber)
		fragment.writeBytes(payload.subarray(start, start + chunkByteSize))
		server.send(
			message(67, fragment.toUint8Array(), fragment.bitLength, nextSequence, true),
			remote.port,
			remote.address,
		)
		nextSequence = (nextSequence + 1) & 1023
	}
	return nextSequence
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
