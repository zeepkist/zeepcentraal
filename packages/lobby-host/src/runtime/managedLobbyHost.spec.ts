import { beforeEach, expect, mock, test } from 'bun:test'
import dgram from 'node:dgram'
import {
	BitReader,
	BitWriter,
	encodeZeepkistLevelPayload,
	ZEEPKIST_PACKET_ID,
} from '@zeepkist/core/zeepnet'
import type { ManagedLobbyProfile } from '../profiles/contracts'
import type { TrackTournamentLeaderboardSnapshot } from '../profiles/trackTournament/leaderboard/trackTournamentLeaderboard'
import { roomLogger } from './telemetry'

interface TestLevel {
	author: string
	collaborators: string
	name: string
	overrideAuthorName: string
	uid: string
	workshopId: bigint
}

interface PlayerContext {
	minimumGtrVersion: string | null
	recentRecord: boolean
	standing?: { rank: number; time: number }
	userExists: boolean
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
let preferredAsset: typeof initialAsset | undefined = initialAsset
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
	TRACK_TOURNAMENT_TYPE: { weekly: 0, monthly: 1 },
}))

const { LevelPayloadCache } = await import('../assets/levelPayloadCache')
const { ManagedLobbyHost } = await import('./managedLobbyHost')
const { TrackTournamentProfile } = await import('../profiles/trackTournament/profile')
const { RoomBrokerClient } = await import('../broker/roomBrokerClient')

beforeEach(() => {
	preferredAsset = initialAsset
	downloadedPayload = preparedPayload
	getJoinId.mockClear()
	setJoinId.mockClear()
	clearJoinId.mockClear()
	getAsset.mockClear()
})

test('shutdown interrupts asset polling wait', async () => {
	preferredAsset = undefined
	const host = createHost(1, 500, 0, 60_000)
	const running = host.run()
	await Bun.sleep(0)
	await host.stop()
	await withTimeout(running)
})

test('generic runtime activates a minimal profile without tournament lookups', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const server = dgram.createSocket('udp4')
	const port = await bind(server)
	const fragments = new Map<number, FragmentGroup>()
	let sequence = 0
	let resolveReady: (() => void) | undefined
	const ready = new Promise<void>((resolve) => {
		resolveReady = resolve
	})
	let signal: AbortSignal | undefined
	let uploaded = false
	const stopSession = mock(() => {})
	const level = {
		level: TEST_LEVEL,
		contentSha256: sha256(preparedPayload),
		compressedData: preparedPayload,
		lease: { data: preparedPayload, release: () => {} },
	}
	const profile: ManagedLobbyProfile = {
		name: 'minimal-test-profile',
		currentLevel: level,
		prepare: async () => level,
		stop: () => {},
		createSession: (context) => {
			signal = context.signal
			return {
				start: () => context.activate(level),
				onPacket: () => {},
				onTransfer: (event) => {
					if (event.type === 'ready') resolveReady?.()
				},
				stop: stopSession,
			}
		},
	}
	server.on('message', (data, remote) => {
		if (handleConnect(server, data, remote) || data[0] !== 67) return
		server.send(acknowledgement(data), remote.port, remote.address)
		const payload = receiveReliablePayload(data, fragments)
		if (!payload) return
		const reader = new BitReader(payload)
		const id = reader.readUInt16()
		if (id === ZEEPKIST_PACKET_ID.skipToLevel)
			server.send(
				reliable(levelRequestPacket('Track', TEST_LEVEL), sequence++),
				remote.port,
				remote.address,
			)
		if (id === ZEEPKIST_PACKET_ID.levelData) {
			expect(readLevelResponse(reader).data).toEqual(preparedPayload)
			uploaded = true
		}
	})
	const broker = startBroker(port)
	const host = createHost(
		requiredPort(broker.port),
		500,
		0,
		60_000,
		600_000,
		'totw',
		'weekly',
		undefined,
		undefined,
		{ profile },
	)
	const running = host.run()
	try {
		await withTimeout(ready)
		expect(uploaded).toBe(true)
		expect(getAsset).not.toHaveBeenCalled()
	} finally {
		await host.stop()
		await withTimeout(running)
		await broker.stop(true)
		await close(server)
		globalThis.fetch = originalFetch
	}
	expect(signal?.aborted).toBe(true)
	expect(stopSession).toHaveBeenCalledTimes(1)
})

test('matches C# playlist transition and serves every level-data request', async () => {
	const originalFetch = globalThis.fetch
	globalThis.fetch = Bun.fetch
	const gameServer = dgram.createSocket('udp4')
	const gamePort = await bind(gameServer)
	const fragments = new Map<number, FragmentGroup>()
	const sentPacketIds: number[] = []
	const visibilityChanges: boolean[] = []
	const chatCommands: string[] = []
	const targetedMessages: Array<{ hostname: string; message: string; steamId: bigint }> = []
	const standingMessages: typeof targetedMessages = []
	const leaderboardUpdates: { time: number; isOverride: boolean; position: string }[] = []
	let incomingSequence = 0
	let playlistSequence: number | undefined
	let skipSequence: number | undefined
	let connectedAt = 0
	let playlistSentAt = 0
	let responseCount = 0
	let roundTransitionSent = false
	let publishLeaderboard: ((snapshot: TrackTournamentLeaderboardSnapshot) => void) | undefined
	let resolveResponses: (() => void) | undefined
	const responsesComplete = new Promise<void>((resolve) => {
		resolveResponses = resolve
	})
	const maybeResolve = () => {
		if (
			responseCount >= 3 &&
			standingMessages.length === 1 &&
			leaderboardUpdates.some((update) => update.position === '18') &&
			chatCommands.some((command) => command.includes('3 Entries')) &&
			targetedMessages.length >= 2
		)
			resolveResponses?.()
	}

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
		if (packetId === ZEEPKIST_PACKET_ID.changeLobbyVisibility) {
			visibilityChanges.push(reader.readBoolean())
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.chatMessage) {
			expect(reader.readUInt32()).toBe(0)
			chatCommands.push(reader.readString())
			expect(reader.readInt32()).toBe(0)
			if (chatCommands.length === 2 && !roundTransitionSent) {
				roundTransitionSent = true
				publishLeaderboard?.({
					entries: 3,
					standings: [],
					connectedPlayers: [
						{
							steamId: '76561198000000042',
							recordId: 10,
							time: 34.234,
							rank: 17,
							points: 400,
						},
					],
				})
				gameServer.send(
					reliable(initialRosterPacket(), incomingSequence++),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(
						playerConnectedPacket(42, 76561198000000042n, 'Resolved'),
						incomingSequence++,
					),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(
						playerConnectedPacket(43, 76561198000000043n, 'Second'),
						incomingSequence++,
					),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(gameStatePacket(1), incomingSequence++),
					remote.port,
					remote.address,
				)
				gameServer.send(
					reliable(gameStatePacket(0), incomingSequence++),
					remote.port,
					remote.address,
				)
			}
			maybeResolve()
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.customChatMessage) {
			const message = {
				steamId: reader.readUInt64(),
				message: reader.readString(),
				hostname: reader.readString(),
			}
			if (message.message.includes('Welcome to')) targetedMessages.push(message)
			else standingMessages.push(message)
			maybeResolve()
			return
		}
		if (packetId === ZEEPKIST_PACKET_ID.customLeaderboard) {
			const id = reader.readUInt64()
			expect(reader.readBoolean()).toBe(false)
			const time = reader.readFloat32()
			expect(reader.readInt32()).toBe(0)
			expect(reader.readBoolean()).toBe(false)
			const isOverride = reader.readBoolean()
			reader.readString()
			const position = reader.readString()
			if (id === 76561198000000042n) {
				leaderboardUpdates.push({ time, isOverride, position })
				if (position === '17')
					publishLeaderboard?.({
						entries: 3,
						standings: [],
						connectedPlayers: [
							{
								steamId: '76561198000000042',
								recordId: 10,
								time: 34.234,
								rank: 18,
								points: 390,
							},
						],
					})
			}
			maybeResolve()
			return
		}

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
			maybeResolve()
		}
	})

	const lookupPlayerContext = mock(async () => ({
		minimumGtrVersion: '1.17.3',
		recentRecord: true,
		standing: { rank: 12, time: 34.234 },
		userExists: true,
	}))
	const broker = startBroker(gamePort)
	const host = createHost(
		requiredPort(broker.port),
		500,
		40,
		60_000,
		50,
		'totw',
		'weekly',
		lookupPlayerContext,
		(_key, _tournamentId, onSnapshot) => {
			publishLeaderboard = onSnapshot
			onSnapshot({ entries: 2, standings: [] })
			return () => {}
		},
		{
			setPlayers: (_key, ids) => {
				if (ids.includes(76561198000000042n))
					publishLeaderboard?.({
						entries: 3,
						standings: [],
						connectedPlayers: [
							{
								steamId: '76561198000000042',
								recordId: 10,
								time: 34.234,
								rank: 17,
								points: 400,
							},
						],
					})
			},
		},
	)
	const running = host.run()
	try {
		await withTimeout(responsesComplete)
		await host.stop()
		await withTimeout(running)
		expect(setJoinId).toHaveBeenCalledWith('totw', 'managed-room')
		expect(leaderboardUpdates.map((update) => update.isOverride)).toEqual([false, true, true])
		expect(leaderboardUpdates[0]?.time).toBe(Math.fround(34.234))
		expect(sentPacketIds.slice(0, 3)).toEqual([
			ZEEPKIST_PACKET_ID.changeLobbyVisibility,
			ZEEPKIST_PACKET_ID.changeLobbyPlaylist,
			ZEEPKIST_PACKET_ID.skipToLevel,
		])
		expect(visibilityChanges).toEqual([true, false])
		expect(skipSequence).toBe(((playlistSequence ?? -1) + 1) & 1023)
		expect(playlistSentAt - connectedAt).toBeGreaterThanOrEqual(35)
		expect(
			sentPacketIds.filter((packetId) => packetId === ZEEPKIST_PACKET_ID.levelData),
		).toHaveLength(3)
		expect(sentPacketIds).not.toContain(ZEEPKIST_PACKET_ID.levelLoaded)
		expect(sentPacketIds).toContain(ZEEPKIST_PACKET_ID.changeLobbyVisibility)
		expect(chatCommands[0]).toBe('/joinmessage off')
		expect(chatCommands).not.toContainEqual(expect.stringContaining('/joinmessage yellow'))
		expect(chatCommands[1]).toStartWith('/servermessage yellow 900 ')
		expect(chatCommands[1]).toContain('2 Entries')
		expect(chatCommands.some((command) => command.includes('3 Entries'))).toBe(true)
		expect(targetedMessages.map((message) => message.steamId).toSorted()).toEqual([
			76561198000000042n,
			76561198000000043n,
		])
		expect(targetedMessages[0]?.hostname).toBe('<color=#facc15>HOST</color>')
		expect(targetedMessages[0]?.message).toContain('Welcome to Track of the Week,')
		expect(targetedMessages[0]?.message).toContain(
			'You are currently #12 on the tournament leaderboard with 00:34.234.',
		)
		expect(targetedMessages).toHaveLength(2)
		expect(lookupPlayerContext).toHaveBeenCalledTimes(2)
		expect(standingMessages[0]?.steamId).toBe(76561198000000042n)
		expect(standingMessages[0]?.message).toContain('Rank dropped')
		expect(standingMessages[0]?.message).toContain('down 1 position')
		expect(standingMessages[0]?.message).toContain('00:34.234 (unchanged)')
		expect(standingMessages[0]?.message).toContain('390 pts')
	} finally {
		await host.stop()
		await broker.stop(true)
		await close(gameServer)
		globalThis.fetch = originalFetch
	}
})

for (const scenario of [
	{ isPublic: true, name: 'created public room', roomCreated: true },
	{ isPublic: false, name: 'rejoined private room', roomCreated: false },
]) {
	test(`restores configured visibility for ${scenario.name}`, async () => {
		const originalFetch = globalThis.fetch
		globalThis.fetch = Bun.fetch
		const gameServer = dgram.createSocket('udp4')
		const gamePort = await bind(gameServer)
		const fragments = new Map<number, FragmentGroup>()
		const visibilityChanges: boolean[] = []
		let resolveVisibility: (() => void) | undefined
		const visibilityApplied = new Promise<void>((resolve) => {
			resolveVisibility = resolve
		})

		gameServer.on('message', (data, remote) => {
			if (handleConnect(gameServer, data, remote)) return
			if (data[0] !== 67) return
			gameServer.send(acknowledgement(data), remote.port, remote.address)
			const payload = receiveReliablePayload(data, fragments)
			if (!payload) return
			const reader = new BitReader(payload)
			if (reader.readUInt16() !== ZEEPKIST_PACKET_ID.changeLobbyVisibility) return
			visibilityChanges.push(reader.readBoolean())
			if (visibilityChanges.length === 1) resolveVisibility?.()
		})

		const broker = startBroker(gamePort, undefined, scenario.roomCreated)
		const host = createHost(
			requiredPort(broker.port),
			500,
			0,
			60_000,
			600_000,
			'totw',
			'weekly',
			undefined,
			undefined,
			{ isPublic: scenario.isPublic },
		)
		const running = host.run()
		try {
			await withTimeout(visibilityApplied)
			await host.stop()
			await withTimeout(running)
			expect(visibilityChanges[0]).toBe(scenario.isPublic)
			expect(visibilityChanges.at(-1)).toBe(false)
			if (!scenario.isPublic) expect(visibilityChanges).not.toContain(true)
		} finally {
			await host.stop()
			await broker.stop(true)
			await close(gameServer)
			globalThis.fetch = originalFetch
		}
	})
}

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

function createHost(
	brokerPort: number,
	protocolTimeoutMs: number,
	playlistDelayMs: number,
	assetPollMs = 60_000,
	messageRefreshMs = 600_000,
	roomKey = 'totw',
	tournamentType: 'monthly' | 'weekly' = 'weekly',
	lookupPlayerContext: (
		tournamentId: number,
		steamId: bigint,
		recentSince: string,
	) => Promise<PlayerContext> = async () => ({
		minimumGtrVersion: null,
		recentRecord: false,
		userExists: false,
	}),
	watchLeaderboard: (
		key: string,
		tournamentId: number,
		onSnapshot: (snapshot: TrackTournamentLeaderboardSnapshot) => void,
	) => () => void = () => () => {},
	options: {
		isPublic?: boolean
		setPlayers?: (key: string, ids: bigint[]) => void
		profile?: ManagedLobbyProfile
	} = {},
) {
	const config = {
		key: roomKey,
		profile: { type: 'track-tournament' as const, tournamentType },
		room: { name: 'Track of the Week', isPublic: options.isPublic ?? true, maxPlayers: 64 },
		assetPollMs,
		messageRefreshMs,
		reconnectMaxMs: 5_000,
		roundTimeSeconds: 900,
	}
	const shared = {
		leaderboard: {
			setPlayers: options.setPlayers ?? (() => {}),
			close: async () => {},
			lookupPlayerContext,
			watch: watchLeaderboard,
		} as never,
		payloads: new LevelPayloadCache(),
	}
	return new ManagedLobbyHost(
		config,
		new RoomBrokerClient(`http://127.0.0.1:${brokerPort}`, 'b'.repeat(32)),
		options.profile ?? new TrackTournamentProfile(config, shared, roomLogger(roomKey)),
		protocolTimeoutMs,
		playlistDelayMs,
	)
}

function requiredPort(port: number | undefined) {
	if (!port) throw new Error('Test server port unavailable')
	return port
}

function startBroker(gamePort: number, onRequest?: () => void, roomCreated = false) {
	return Bun.serve({
		hostname: '127.0.0.1',
		port: 0,
		fetch: () => {
			onRequest?.()
			return Response.json({
				host: '127.0.0.1',
				joinId: 'managed-room',
				key: 'totw',
				playerUid: 7,
				port: gamePort,
				roomCreated,
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

function gameStatePacket(state: number) {
	return packet(ZEEPKIST_PACKET_ID.changeLobbyGameState, (writer) => writer.writeInt32(state))
}

function playerConnectedPacket(uid: number, steamId: bigint, username: string) {
	return packet(ZEEPKIST_PACKET_ID.playerConnected, (writer) => {
		writer.writeUInt32(uid)
		writer.writeUInt64(steamId)
		writer.writeBoolean(false)
		writer.writeBoolean(false)
		writer.writeString('')
		writer.writeString(`${username} Backup`)
		writer.writeString(username)
	})
}

function initialRosterPacket() {
	return packet(ZEEPKIST_PACKET_ID.initialState, (writer) => {
		writer.writeInt32(2)
		writeInitialPlayer(writer, 7, 76561198000000000n, 'Host', true)
		writeInitialPlayer(writer, 41, 76561198000000041n, 'Existing', false)
	})
}

function writeInitialPlayer(
	writer: BitWriter,
	uid: number,
	steamId: bigint,
	backupName: string,
	isHost: boolean,
) {
	writer.writeUInt32(uid)
	writer.writeUInt64(steamId)
	writer.writeString('')
	writer.writeString(backupName)
	writer.writeBoolean(isHost)
	writer.writeString('{}')
	for (let index = 0; index < 10; index++) writer.writeFloat32(index + 0.5)
	writer.writeBoolean(false)
	writer.writeBoolean(false)
	writer.writeByte(0)
	for (let index = 0; index < 13; index++) writer.writeBoolean(false)
	writer.writeInt32(0)
	writer.writeInt32(0)
	writer.writeBoolean(false)
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
		tournamentEndAt: '2027-01-01T00:00:00.000Z',
		tournamentSlug: '2026-w33',
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
