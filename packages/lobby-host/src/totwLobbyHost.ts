import { createHash } from 'node:crypto'
import {
	BitWriter,
	changeLobbyPlaylistPacket,
	changeLobbyVisibilityPacket,
	type GameHostPacket,
	LidgrenClient,
	levelDataPacket,
	levelDataRequestPacket,
	levelLoadedPacket,
	type OnlineLevel,
	type OnlinePlaylist,
	parseGameHostPacket,
	skipToLevelPacket,
} from '@zeepkist/core/zeepnet'
import {
	clearManagedLobbyJoinId,
	downloadTrackTournamentLobbyAsset,
	getManagedLobbyJoinId,
	getPreferredTrackTournamentLobbyAsset,
	setManagedLobbyJoinId,
} from '@zeepkist/database'
import { getMeter } from '@zeepkist/telemetry'

const MANAGED_LOBBY_KEY = 'totw'
const INITIAL_STATE_TIMEOUT_MS = 20_000
const PROTOCOL_TRANSITION_TIMEOUT_MS = 30_000
const MAX_ASSET_BYTES = 64 * 1024 * 1024
const meter = getMeter('zeepcentraal-lobby-host')
const assignmentLatency = meter.createHistogram('zeepkist.totw.assignment.duration', {
	description: 'Room broker assignment latency',
	unit: 'ms',
})
const reconnects = meter.createCounter('zeepkist.totw.reconnects', {
	description: 'Failed room connections followed by retry',
})
const replacements = meter.createCounter('zeepkist.totw.replacements', {
	description: 'Managed rooms replaced after ownership transfer',
})

interface HostConfig {
	assetPollMs: number
	brokerToken: string
	brokerUrl: string
	reconnectMaxMs: number
	roundTimeSeconds: number
}

interface RoomAssignment {
	host: string
	joinId: string
	playerUid: number
	port: number
	steamId: string
	token: string
}

interface LoadedAsset {
	compressedData: Buffer
	contentSha256: string
	idTournament: number
	level: OnlineLevel
}

type GamePropertiesPacket = Extract<GameHostPacket, { type: 'game-properties' }>
type LevelDataResponsePacket = Extract<GameHostPacket, { type: 'level-data' }>
type LevelRequestPacket = Extract<GameHostPacket, { type: 'level-request' }>
type PlaylistIndexPacket = Extract<GameHostPacket, { type: 'playlist-index' }>

interface RoomInboxes {
	gameProperties: PacketInbox<GamePropertiesPacket>
	levelData: PacketInbox<LevelDataResponsePacket>
	levelRequests: PacketInbox<LevelRequestPacket>
	playlistIndices: PacketInbox<PlaylistIndexPacket>
	playlists: PacketInbox<OnlinePlaylist>
}

export class TotwLobbyHost {
	private stopped = false
	private client: LidgrenClient | undefined
	private asset: LoadedAsset | undefined
	private refreshPromise: Promise<void> | undefined
	private roomConnected = false
	private roomReady = false
	private ownsRoom = false

	constructor(
		private readonly config: HostConfig,
		private readonly protocolTransitionTimeoutMs = PROTOCOL_TRANSITION_TIMEOUT_MS,
	) {
		meter.createObservableGauge('zeepkist.totw.asset.ready').addCallback((result) =>
			result.observe(this.asset ? 1 : 0, {
				tournament_id: this.asset?.idTournament.toString() ?? 'none',
			}),
		)
		meter
			.createObservableGauge('zeepkist.totw.tournament.active')
			.addCallback((result) => result.observe(this.asset?.idTournament ?? 0))
		meter
			.createObservableGauge('zeepkist.totw.room.connected')
			.addCallback((result) => result.observe(this.roomConnected ? 1 : 0))
		meter
			.createObservableGauge('zeepkist.totw.room.ready')
			.addCallback((result) => result.observe(this.roomReady ? 1 : 0))
		meter
			.createObservableGauge('zeepkist.totw.host.owned')
			.addCallback((result) => result.observe(this.ownsRoom ? 1 : 0))
	}

	async run() {
		let retryMs = 1_000
		while (!this.stopped) {
			try {
				await this.refreshAsset()
				if (!this.asset) {
					console.warn('TotW lobby asset unavailable; waiting before room assignment.')
					await delay(this.config.assetPollMs)
					continue
				}
				await this.connectRoom()
				retryMs = 1_000
			} catch (error) {
				if (!this.stopped) {
					reconnects.add(1)
					console.warn(`TotW lobby host connection failed; retrying: ${safeError(error)}`)
				}
			}
			if (!this.stopped) {
				await delay(withJitter(retryMs))
				retryMs = Math.min(retryMs * 2, this.config.reconnectMaxMs)
			}
		}
	}

	async stop() {
		this.stopped = true
		const client = this.client
		if (!client) return
		try {
			await client.sendReliableOrdered(changeLobbyVisibilityPacket(false))
		} catch {
			console.warn('TotW lobby host could not make room private before shutdown.')
		}
		await client.close('TotW lobby host shutting down')
	}

	private async connectRoom() {
		const joinId = await getManagedLobbyJoinId(MANAGED_LOBBY_KEY)
		const assignment = await this.requestAssignment(joinId)
		await setManagedLobbyJoinId(MANAGED_LOBBY_KEY, assignment.joinId)
		const hail = new BitWriter()
		hail.writeString(assignment.token)
		let initialResolve: ((isHost: boolean) => void) | undefined
		const initialState = new Promise<boolean>((resolve) => {
			initialResolve = resolve
		})
		const inboxes: RoomInboxes = {
			gameProperties: new PacketInbox(),
			levelData: new PacketInbox(2),
			levelRequests: new PacketInbox(),
			playlistIndices: new PacketInbox(),
			playlists: new PacketInbox(),
		}
		const initialPlaylistCursor = inboxes.playlists.mark()
		let lostOwnership = false
		let client: LidgrenClient
		client = new LidgrenClient({
			applicationIdentifier: 'GameServer',
			host: assignment.host,
			port: assignment.port,
			hail: hail.toUint8Array(),
			onPayload: (payload) => {
				try {
					const packet = parseGameHostPacket(payload, BigInt(assignment.steamId))
					if (!packet) return
					if (packet.type === 'initial') {
						initialResolve?.(packet.isHost)
						return
					}
					if (packet.type === 'master') {
						if (packet.uid !== assignment.playerUid) {
							lostOwnership = true
							this.ownsRoom = false
							replacements.add(1)
							console.warn('TotW lobby ownership transferred; creating replacement.')
							void client.close('Managed account lost lobby ownership')
						}
						return
					}
					if (packet.type === 'playlist') {
						inboxes.playlists.push(packet)
						return
					}
					if (packet.type === 'playlist-index') {
						inboxes.playlistIndices.push(packet)
						if (packet.selectNext && this.roomReady) {
							void this.resendPlaylist(client).catch(() =>
								client.close('Failed to update lobby playlist'),
							)
						}
						return
					}
					if (packet.type === 'game-properties') {
						inboxes.gameProperties.push(packet)
						return
					}
					if (packet.type === 'level-request') {
						inboxes.levelRequests.push(packet)
						return
					}
					if (packet.type === 'level-data') {
						inboxes.levelData.push(packet)
					}
				} catch {
					void client.close('Invalid game server packet')
				}
			},
		})
		this.client = client
		try {
			await client.connect()
			const isHost = await withTimeout(
				initialState,
				INITIAL_STATE_TIMEOUT_MS,
				'Initial game state timed out',
			)
			if (!isHost) {
				await clearManagedLobbyJoinId(MANAGED_LOBBY_KEY)
				throw new Error('Managed account no longer owns assigned room')
			}
			this.roomConnected = true
			this.ownsRoom = true
			await inboxes.playlists.waitForAfter(
				initialPlaylistCursor,
				() => true,
				this.protocolTransitionTimeoutMs,
				'Initial lobby playlist timed out',
			)
			console.info(
				`TotW lobby initial playlist received for tournament ${this.asset?.idTournament}.`,
			)
			const postReadinessPlaylistCursor = inboxes.playlists.mark()
			await client.sendReliableOrdered(levelLoadedPacket())
			console.info(
				`TotW lobby initial level readiness acknowledged for tournament ${this.asset?.idTournament}.`,
			)
			await inboxes.playlists.waitForAfter(
				postReadinessPlaylistCursor,
				() => true,
				this.protocolTransitionTimeoutMs,
				'Post-readiness lobby playlist timed out',
			)
			console.info(
				`TotW lobby post-readiness playlist synchronized for tournament ${this.asset?.idTournament}.`,
			)
			let activeAssetHash: string | undefined
			let activationQueue = Promise.resolve()
			const activate = (asset: LoadedAsset) => {
				const activation = activationQueue.then(async () => {
					if (asset.contentSha256 === activeAssetHash) return
					this.roomReady = false
					await this.activateAsset(client, asset, inboxes)
					activeAssetHash = asset.contentSha256
					this.roomReady = true
				})
				activationQueue = activation.catch(() => {})
				return activation
			}
			const initialAsset = this.asset
			if (!initialAsset) throw new Error('Tournament asset became unavailable')
			await activate(initialAsset)
			console.info(`TotW lobby host connected for tournament ${initialAsset.idTournament}.`)
			const assetTimer = setInterval(() => {
				void this.refreshAndPublish(activate).catch((error) => {
					console.warn(`TotW lobby asset refresh failed: ${safeError(error)}`)
					void client.close('Failed to update lobby tournament asset')
				})
			}, this.config.assetPollMs)
			try {
				await client.waitForClose()
			} finally {
				clearInterval(assetTimer)
			}
		} finally {
			for (const inbox of Object.values(inboxes))
				inbox.rejectAll(new Error('Game server connection closed'))
			this.roomConnected = false
			this.roomReady = false
			this.ownsRoom = false
			if (this.client === client) this.client = undefined
			await client.close()
			if (lostOwnership) await clearManagedLobbyJoinId(MANAGED_LOBBY_KEY)
		}
	}

	private async refreshAndPublish(activate: (asset: LoadedAsset) => Promise<void>) {
		const previousHash = this.asset?.contentSha256
		await this.refreshAsset()
		if (this.asset && this.asset.contentSha256 !== previousHash) await activate(this.asset)
	}

	private async refreshAsset() {
		this.refreshPromise ??= this.refreshAssetOnce().finally(() => {
			this.refreshPromise = undefined
		})
		return this.refreshPromise
	}

	private async refreshAssetOnce() {
		const metadata = await getPreferredTrackTournamentLobbyAsset()
		if (!metadata || metadata.contentSha256 === this.asset?.contentSha256) return
		if (metadata.byteSize < 1 || metadata.byteSize > MAX_ASSET_BYTES) {
			throw new Error('Prepared tournament asset size is invalid')
		}
		const compressedData = await downloadTrackTournamentLobbyAsset(metadata.objectKey)
		if (compressedData.length !== metadata.byteSize)
			throw new Error('Tournament asset size mismatch')
		const sha256 = createHash('sha256').update(compressedData).digest('hex')
		if (sha256 !== metadata.contentSha256) throw new Error('Tournament asset hash mismatch')
		this.asset = {
			compressedData,
			contentSha256: sha256,
			idTournament: metadata.idTournament,
			level: {
				author: metadata.author,
				collaborators: metadata.collaborators,
				name: metadata.levelName,
				overrideAuthorName: metadata.overrideAuthorName,
				uid: metadata.fileUid,
				workshopId: metadata.workshopId,
			},
		}
		console.info(`TotW lobby asset ready for tournament ${metadata.idTournament}.`)
	}

	private async resendPlaylist(client: LidgrenClient) {
		const asset = this.asset
		if (!asset) return
		await client.sendReliableOrdered(
			changeLobbyPlaylistPacket(asset.level, this.config.roundTimeSeconds, {
				currentIndex: 0,
				nextIndex: 0,
			}),
		)
	}

	private async activateAsset(client: LidgrenClient, asset: LoadedAsset, inboxes: RoomInboxes) {
		const playlistCursor = inboxes.playlists.mark()
		const playlistIndexCursor = inboxes.playlistIndices.mark()
		await client.sendReliableOrdered(
			changeLobbyPlaylistPacket(asset.level, this.config.roundTimeSeconds, {
				currentIndex: 0,
				nextIndex: 1,
			}),
		)
		console.info(`TotW lobby playlist sent for tournament ${asset.idTournament}.`)
		await Promise.all([
			inboxes.playlists.waitForAfter(
				playlistCursor,
				(playlist) => this.matchesPlaylist(playlist, asset, 1),
				this.protocolTransitionTimeoutMs,
				'Lobby playlist confirmation timed out',
			),
			inboxes.playlistIndices.waitForAfter(
				playlistIndexCursor,
				(index) => index.currentIndex === 0 && index.nextIndex === 1 && !index.selectNext,
				this.protocolTransitionTimeoutMs,
				'Lobby playlist index confirmation timed out',
			),
		])
		console.info(`TotW lobby playlist accepted for tournament ${asset.idTournament}.`)

		const levelRequestCursor = inboxes.levelRequests.mark()
		await client.sendReliableOrdered(
			changeLobbyPlaylistPacket(asset.level, this.config.roundTimeSeconds, {
				currentIndex: 0,
				nextIndex: 0,
			}),
		)
		await client.sendReliableOrdered(skipToLevelPacket(asset.level))
		console.info(`TotW lobby level switch requested for tournament ${asset.idTournament}.`)
		await inboxes.levelRequests.waitForAfter(
			levelRequestCursor,
			(request) =>
				request.uid === asset.level.uid && request.workshopId === asset.level.workshopId,
			this.protocolTransitionTimeoutMs,
			'Lobby level-data request timed out',
		)
		console.info(`TotW lobby level-data request received for tournament ${asset.idTournament}.`)

		const gamePropertiesCursor = inboxes.gameProperties.mark()
		await client.sendReliableOrdered(levelDataPacket(asset.level, asset.compressedData))
		console.info(
			`TotW lobby level data uploaded for tournament ${asset.idTournament} (${asset.compressedData.length} bytes).`,
		)
		await inboxes.gameProperties.waitForAfter(
			gamePropertiesCursor,
			(properties) =>
				properties.uid === asset.level.uid &&
				properties.workshopId === asset.level.workshopId,
			this.protocolTransitionTimeoutMs,
			'Game server game properties confirmation timed out',
		)
		console.info(`TotW lobby game properties confirmed for tournament ${asset.idTournament}.`)

		const levelDataCursor = inboxes.levelData.mark()
		await client.sendReliableOrdered(levelDataRequestPacket())
		console.info(`TotW lobby level data requested for tournament ${asset.idTournament}.`)
		const returnedLevel = await inboxes.levelData.waitForAfter(
			levelDataCursor,
			() => true,
			this.protocolTransitionTimeoutMs,
			'Game server level-data response timed out',
		)
		this.verifyReturnedLevelData(returnedLevel, asset)
		console.info(
			`TotW lobby returned level data verified for tournament ${asset.idTournament}.`,
		)

		const postLoadedPlaylistCursor = inboxes.playlists.mark()
		await client.sendReliableOrdered(levelLoadedPacket())
		console.info(
			`TotW lobby level loaded acknowledgement sent for tournament ${asset.idTournament}.`,
		)
		await inboxes.playlists.waitForAfter(
			postLoadedPlaylistCursor,
			(playlist) => this.matchesPlaylist(playlist, asset, 0),
			this.protocolTransitionTimeoutMs,
			'Post-load lobby playlist confirmation timed out',
		)
		console.info(`TotW lobby ready for tournament ${asset.idTournament}.`)
	}

	private matchesPlaylist(playlist: OnlinePlaylist, asset: LoadedAsset, nextIndex: number) {
		const level = playlist.levels[0]
		return (
			playlist.roundTime === this.config.roundTimeSeconds &&
			!playlist.isRandom &&
			playlist.currentIndex === 0 &&
			playlist.nextIndex === nextIndex &&
			playlist.wasSynced &&
			playlist.originalPlaylistLength === 1 &&
			playlist.levels.length === 1 &&
			level?.uid === asset.level.uid &&
			level.workshopId === asset.level.workshopId &&
			level.name === asset.level.name &&
			level.collaborators === asset.level.collaborators &&
			level.overrideAuthorName === asset.level.overrideAuthorName &&
			level.author === asset.level.author &&
			level.played
		)
	}

	private verifyReturnedLevelData(packet: LevelDataResponsePacket, asset: LoadedAsset) {
		if (packet.name !== asset.level.name)
			throw new Error('Returned tournament level name mismatch')
		if (packet.data.length !== asset.compressedData.length)
			throw new Error('Returned tournament level size mismatch')
		const sha256 = createHash('sha256').update(packet.data).digest('hex')
		if (sha256 !== asset.contentSha256)
			throw new Error('Returned tournament level hash mismatch')
	}

	private async requestAssignment(joinId?: string): Promise<RoomAssignment> {
		const startedAt = performance.now()
		try {
			const response = await fetch(`${this.config.brokerUrl}/v1/totw/assignment`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${this.config.brokerToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(joinId ? { joinId } : {}),
				signal: AbortSignal.timeout(20_000),
			})
			if (!response.ok) throw new Error(`Room broker returned HTTP ${response.status}`)
			return parseAssignment(await response.json())
		} finally {
			assignmentLatency.record(performance.now() - startedAt)
		}
	}
}

function parseAssignment(value: unknown): RoomAssignment {
	if (typeof value !== 'object' || value === null)
		throw new Error('Room broker response is invalid')
	const assignment = value as Partial<RoomAssignment>
	if (
		typeof assignment.host !== 'string' ||
		assignment.host.length === 0 ||
		typeof assignment.joinId !== 'string' ||
		assignment.joinId.length === 0 ||
		typeof assignment.playerUid !== 'number' ||
		!Number.isInteger(assignment.playerUid) ||
		typeof assignment.port !== 'number' ||
		!Number.isInteger(assignment.port) ||
		assignment.port < 1 ||
		assignment.port > 65_535 ||
		typeof assignment.steamId !== 'string' ||
		!/^[0-9]{17,20}$/.test(assignment.steamId) ||
		typeof assignment.token !== 'string' ||
		assignment.token.length === 0
	) {
		throw new Error('Room broker response is invalid')
	}
	return assignment as RoomAssignment
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error(message)), timeoutMs)
			}),
		])
	} finally {
		if (timer) clearTimeout(timer)
	}
}

function delay(ms: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function withJitter(ms: number) {
	return Math.round(ms * (0.8 + Math.random() * 0.4))
}

function safeError(error: unknown) {
	return (error instanceof Error ? error.message : 'Unknown error')
		.replace(/[\r\n\t]/g, ' ')
		.slice(0, 200)
}

interface InboxEvent<T> {
	sequence: number
	value: T
}

interface InboxWaiter<T> {
	afterSequence: number
	matches: (value: T) => boolean
	reject: (error: Error) => void
	resolve: (value: T) => void
	timer: ReturnType<typeof setTimeout>
}

class PacketInbox<T> {
	private sequence = 0
	private readonly events: InboxEvent<T>[] = []
	private readonly waiters = new Set<InboxWaiter<T>>()

	constructor(private readonly maxEvents = 8) {}

	mark() {
		return this.sequence
	}

	waitForAfter(
		afterSequence: number,
		matches: (value: T) => boolean,
		timeoutMs: number,
		timeoutMessage: string,
	) {
		const existingIndex = this.events.findIndex(
			(event) => event.sequence > afterSequence && matches(event.value),
		)
		if (existingIndex >= 0) {
			const [existing] = this.events.splice(existingIndex, 1)
			if (existing) return Promise.resolve(existing.value)
		}
		return new Promise<T>((resolve, reject) => {
			const waiter: InboxWaiter<T> = {
				afterSequence,
				matches,
				reject,
				resolve,
				timer: setTimeout(() => {
					this.waiters.delete(waiter)
					reject(new Error(timeoutMessage))
				}, timeoutMs),
			}
			this.waiters.add(waiter)
		})
	}

	push(value: T) {
		const event = { sequence: ++this.sequence, value }
		let consumed = false
		for (const waiter of this.waiters) {
			if (event.sequence <= waiter.afterSequence || !waiter.matches(value)) continue
			clearTimeout(waiter.timer)
			this.waiters.delete(waiter)
			waiter.resolve(value)
			consumed = true
		}
		if (consumed) return
		this.events.push(event)
		if (this.events.length > this.maxEvents) this.events.shift()
	}

	rejectAll(error: Error) {
		for (const waiter of this.waiters) {
			clearTimeout(waiter.timer)
			waiter.reject(error)
		}
		this.waiters.clear()
		this.events.length = 0
	}
}
