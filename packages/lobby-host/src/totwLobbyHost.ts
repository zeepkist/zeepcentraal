import {
	BitWriter,
	changeLobbyPlaylistPacket,
	changeLobbyVisibilityPacket,
	chatMessagePacket,
	type GameHostPacket,
	LidgrenClient,
	LidgrenRemoteDisconnectError,
	levelDataPacket,
	type OnlineLevel,
	parseGameHostPacket,
	skipToLevelPacket,
} from '@zeepkist/core/zeepnet'
import {
	downloadTrackTournamentLobbyAsset,
	getManagedLobbyJoinId,
	getPreferredTrackTournamentLobbyAsset,
	setManagedLobbyJoinId,
} from '@zeepkist/database'
import { getMeter, tracedFetch, withActiveSpan } from '@zeepkist/telemetry'
import { TotwLeaderboardClient } from './totwLeaderboard'
import {
	buildTotwServerMessageCommand,
	leaderboardSignature,
	TOTW_JOIN_MESSAGE_COMMAND,
	type TotwLeaderboardStanding,
} from './totwMessages'

const MANAGED_LOBBY_KEY = 'totw'
const PLAYLIST_CHANGE_DELAY_MS = 3_500
const PROTOCOL_TRANSITION_TIMEOUT_MS = 30_000
const PREVIOUS_ASSET_TTL_MS = 30_000
const MAX_LEVEL_REQUESTS = 8
const MAX_ASSET_BYTES = 64 * 1024 * 1024
const MESSAGE_CHANGE_DEBOUNCE_MS = 1_000
const MESSAGE_RETRY_MS = 30_000
const meter = getMeter('zeepcentraal-lobby-host')
const assignmentLatency = meter.createHistogram('zeepkist.totw.assignment.duration', {
	description: 'Room broker assignment latency',
	unit: 'ms',
})
const reconnects = meter.createCounter('zeepkist.totw.reconnects', {
	description: 'Failed room connections followed by retry',
})
const connectionDuration = meter.createHistogram('zeepkist.totw.connection.duration', {
	description: 'GameServer connection lifetime',
	unit: 'ms',
})
const afkDisconnects = meter.createCounter('zeepkist.totw.disconnects.afk', {
	description: 'GameServer disconnects categorized as AFK',
})

interface HostConfig {
	assetPollMs: number
	brokerToken: string
	brokerUrl: string
	graphqlWsUrl: string
	messageRefreshMs: number
	reconnectMaxMs: number
	roundTimeSeconds: number
}

interface RoomAssignment {
	host: string
	joinId: string
	playerUid: number
	port: number
	roomCreated: boolean
	steamId: string
	token: string
}

interface LoadedAsset {
	compressedData: Uint8Array
	contentSha256: string
	idTournament: number
	level: OnlineLevel
	tournamentSlug: string
}

type LevelRequestPacket = Extract<GameHostPacket, { type: 'level-request' }>

interface PendingActivation {
	assetHash: string
	promise: Promise<void>
	reject: (error: Error) => void
	resolve: () => void
}

interface RoomTransferState {
	activeAsset?: LoadedAsset
	gameState?: number
	pendingActivation?: PendingActivation
	pendingAsset?: LoadedAsset
	previousAsset?: LoadedAsset
	previousAssetTimer?: ReturnType<typeof setTimeout>
	queuedUploads: number
	uploadQueue: Promise<void>
}

interface GameConnection {
	client: LidgrenClient
	closed: Promise<{ error?: Error }>
}

export class TotwLobbyHost {
	private stopped = false
	private client: LidgrenClient | undefined
	private asset: LoadedAsset | undefined
	private refreshPromise: Promise<void> | undefined
	private roomConnected = false
	private roomReady = false
	private ownsRoom = false
	private standings: TotwLeaderboardStanding[] | undefined
	private standingsSignature: string | undefined
	private watchedTournamentId: number | undefined
	private messageTimer: ReturnType<typeof setTimeout> | undefined
	private messageDebounceTimer: ReturnType<typeof setTimeout> | undefined
	private messageQueue = Promise.resolve()
	private readonly leaderboard: TotwLeaderboardClient

	constructor(
		private readonly config: HostConfig,
		private readonly protocolTransitionTimeoutMs = PROTOCOL_TRANSITION_TIMEOUT_MS,
		private readonly playlistChangeDelayMs = PLAYLIST_CHANGE_DELAY_MS,
		leaderboard?: TotwLeaderboardClient,
	) {
		this.leaderboard =
			leaderboard ??
			new TotwLeaderboardClient(config.graphqlWsUrl, (error) => {
				console.warn(`TotW leaderboard subscription failed: ${safeError(error)}`)
			})
		meter
			.createObservableGauge('zeepkist.totw.asset.ready')
			.addCallback((result) => result.observe(this.asset ? 1 : 0))
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
				await withActiveSpan('lobby.connect', () => this.connectRoom())
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
		this.clearMessageTimers()
		const client = this.client
		this.asset = undefined
		if (client) {
			try {
				await client.sendReliableOrdered(changeLobbyVisibilityPacket(false))
			} catch {
				console.warn('TotW lobby host could not make room private before shutdown.')
			}
		}
		await client?.close('TotW lobby host shutting down')
		await this.leaderboard.close()
	}

	private async connectRoom() {
		const joinId = await getManagedLobbyJoinId(MANAGED_LOBBY_KEY)
		const assignment = await this.requestAssignment(joinId)
		await setManagedLobbyJoinId(MANAGED_LOBBY_KEY, assignment.joinId)
		const transferState: RoomTransferState = {
			queuedUploads: 0,
			uploadQueue: Promise.resolve(),
		}
		const active = await this.createGameConnection(assignment, transferState)
		this.client = active.client
		try {
			this.roomConnected = true
			this.ownsRoom = true
			console.info(
				`TotW lobby GameServer connected; waiting ${this.playlistChangeDelayMs}ms before playlist update.`,
			)
			await waitWhileConnected(active, this.playlistChangeDelayMs)
			const activate = (asset: LoadedAsset) =>
				this.activateAsset(active.client, asset, transferState)
			const initialAsset = this.asset
			if (!initialAsset) throw new Error('Tournament asset became unavailable')
			await activate(initialAsset)
			if (assignment.roomCreated) {
				await active.client.sendReliableOrdered(
					chatMessagePacket(TOTW_JOIN_MESSAGE_COMMAND),
				)
				console.info('TotW lobby join message configured.')
			}
			await this.sendServerMessage(active.client)
			console.info(`TotW lobby host connected for tournament ${initialAsset.idTournament}.`)
			let refreshing = false
			const assetTimer = setInterval(() => {
				if (refreshing) return
				refreshing = true
				void this.refreshAndPublish(activate)
					.catch((error) =>
						console.warn(`TotW lobby asset refresh failed: ${safeError(error)}`),
					)
					.finally(() => {
						refreshing = false
					})
			}, this.config.assetPollMs)
			try {
				const closed = await active.closed
				if (closed.error) throw closed.error
			} finally {
				clearInterval(assetTimer)
			}
		} finally {
			if (transferState.previousAssetTimer) clearTimeout(transferState.previousAssetTimer)
			transferState.pendingAsset = undefined
			transferState.previousAsset = undefined
			transferState.activeAsset = undefined
			this.roomConnected = false
			this.roomReady = false
			this.ownsRoom = false
			this.clearMessageTimers()
			if (this.client === active.client) this.client = undefined
			await active.client.close('Managed room reconnecting')
		}
	}

	private async createGameConnection(
		assignment: RoomAssignment,
		state: RoomTransferState,
	): Promise<GameConnection> {
		const hail = new BitWriter()
		hail.writeString(assignment.token)
		let client: LidgrenClient
		client = new LidgrenClient({
			applicationIdentifier: 'GameServer',
			host: assignment.host,
			port: assignment.port,
			hail: hail.toUint8Array(),
			onPayload: (payload) => {
				try {
					const packet = parseGameHostPacket(
						payload,
						BigInt(assignment.steamId),
						assignment.playerUid,
					)
					if (!packet) return
					if (packet.type === 'initial') {
						if (packet.isHost) this.ownsRoom = true
						else {
							this.ownsRoom = false
							console.warn('TotW lobby ownership unavailable; managed room retained.')
							void client.close('Managed account does not own assigned room')
						}
						return
					}
					if (packet.type === 'master') {
						if (packet.uid === assignment.playerUid) this.ownsRoom = true
						else if (this.client === client) {
							this.ownsRoom = false
							console.warn('TotW lobby ownership transferred; managed room retained.')
							void client.close('Managed account lost lobby ownership')
						}
						return
					}
					if (packet.type === 'game-state') {
						const roundStarted = packet.state === 0 && state.gameState !== 0
						state.gameState = packet.state
						if (roundStarted && this.client === client && this.roomReady) {
							this.queueServerMessage(MESSAGE_CHANGE_DEBOUNCE_MS)
						}
						return
					}
					if (packet.type === 'level-request')
						this.queueLevelUpload(client, packet, state)
				} catch {
					void client.close('Invalid game server packet')
				}
			},
		})
		const connectedAt = Date.now()
		await client.connect()
		const closed: Promise<{ error?: Error }> = client.waitForClose().then(
			() => ({}),
			(error) => ({ error: error instanceof Error ? error : new Error('GameServer closed') }),
		)
		void closed.then(({ error }) => {
			const reason =
				error instanceof LidgrenRemoteDisconnectError
					? error.category
					: error
						? 'error'
						: 'local'
			connectionDuration.record(Date.now() - connectedAt, { reason })
			if (error instanceof LidgrenRemoteDisconnectError && error.category === 'afk') {
				afkDisconnects.add(1)
			}
			if (this.client === client) {
				state.pendingActivation?.reject(error ?? new Error('GameServer connection closed'))
			}
		})
		return { client, closed }
	}

	private queueLevelUpload(
		client: LidgrenClient,
		packet: LevelRequestPacket,
		state: RoomTransferState,
	) {
		if (state.queuedUploads >= MAX_LEVEL_REQUESTS) {
			void client.close('Level request queue exceeded capacity')
			return
		}
		state.queuedUploads++
		const upload = state.uploadQueue
			.then(() => this.uploadRequestedLevel(client, packet, state))
			.finally(() => {
				state.queuedUploads--
			})
		state.uploadQueue = upload.catch(() => {})
		void upload.catch((error) => {
			console.warn(`TotW lobby level upload failed: ${safeError(error)}`)
			void client.close('Failed to supply requested tournament level')
		})
	}

	private async refreshAndPublish(activate: (asset: LoadedAsset) => Promise<void>) {
		await this.refreshAsset()
		if (this.asset) await activate(this.asset)
	}

	private async refreshAsset() {
		this.refreshPromise ??= this.refreshAssetOnce().finally(() => {
			this.refreshPromise = undefined
		})
		return this.refreshPromise
	}

	private async refreshAssetOnce() {
		return withActiveSpan('lobby.asset.refresh', async (span) => {
			const metadata = await getPreferredTrackTournamentLobbyAsset()
			if (!metadata || metadata.contentSha256 === this.asset?.contentSha256) return
			if (metadata.byteSize < 1 || metadata.byteSize > MAX_ASSET_BYTES) {
				throw new Error('Prepared tournament asset size is invalid')
			}
			const compressedData = await downloadTrackTournamentLobbyAsset(metadata)
			this.asset = {
				compressedData,
				contentSha256: metadata.contentSha256,
				idTournament: metadata.idTournament,
				tournamentSlug: metadata.tournamentSlug,
				level: {
					author: metadata.author,
					collaborators: metadata.collaborators,
					name: metadata.levelName,
					overrideAuthorName: metadata.overrideAuthorName,
					uid: metadata.fileUid,
					workshopId: metadata.workshopId,
				},
			}
			this.watchLeaderboard(metadata.idTournament)
			span.addEvent('lobby.asset.ready', {
				'lobby.asset.bytes': compressedData.byteLength,
			})
			console.info(`TotW lobby asset ready for tournament ${metadata.idTournament}.`)
		})
	}

	private async activateAsset(
		client: LidgrenClient,
		asset: LoadedAsset,
		state: RoomTransferState,
	) {
		return withActiveSpan('lobby.asset.activate', async (span) => {
			if (state.activeAsset?.contentSha256 === asset.contentSha256) return
			if (state.pendingActivation?.assetHash === asset.contentSha256) {
				return withTimeout(
					state.pendingActivation.promise,
					this.protocolTransitionTimeoutMs,
					'Lobby level-data request timed out',
				)
			}

			state.pendingAsset = asset
			const activation = createPendingActivation(asset.contentSha256)
			state.pendingActivation = activation
			const playlistSend = client.sendReliableOrdered(
				changeLobbyPlaylistPacket(asset.level, this.config.roundTimeSeconds),
			)
			const skipSend = client.sendReliableOrdered(skipToLevelPacket(asset.level))
			console.info(
				`TotW lobby playlist and level switch sent for tournament ${asset.idTournament}.`,
			)
			try {
				await Promise.all([playlistSend, skipSend])
				await withTimeout(
					activation.promise,
					this.protocolTransitionTimeoutMs,
					'Lobby level-data request timed out',
				)
			} finally {
				if (state.pendingActivation === activation) state.pendingActivation = undefined
			}
			span.addEvent('lobby.protocol.activation.completed')
		})
	}

	private async uploadRequestedLevel(
		client: LidgrenClient,
		request: LevelRequestPacket,
		state: RoomTransferState,
	) {
		return withActiveSpan('lobby.asset.upload', async (span) => {
			const asset = [state.pendingAsset, state.activeAsset, state.previousAsset].find(
				(candidate) => candidate && this.matchesLevelRequest(candidate, request),
			)
			if (!asset) throw new Error('GameServer requested unknown level')

			console.info(
				`TotW lobby level-data request received for tournament ${asset.idTournament}.`,
			)
			await client.sendReliableOrdered(levelDataPacket(request, asset.compressedData))
			span.addEvent('lobby.asset.uploaded', {
				'lobby.asset.bytes': asset.compressedData.length,
			})
			console.info(
				`TotW lobby level data uploaded for tournament ${asset.idTournament} (${asset.compressedData.length} bytes).`,
			)
			if (
				state.activeAsset?.contentSha256 === asset.contentSha256 &&
				state.pendingAsset?.contentSha256 !== asset.contentSha256 &&
				this.roomReady
			) {
				this.queueServerMessage(MESSAGE_CHANGE_DEBOUNCE_MS)
			}

			if (state.pendingAsset?.contentSha256 !== asset.contentSha256) return
			state.previousAsset = state.activeAsset
			if (state.previousAssetTimer) clearTimeout(state.previousAssetTimer)
			const previousAsset = state.previousAsset
			state.previousAssetTimer = setTimeout(() => {
				if (state.previousAsset === previousAsset) state.previousAsset = undefined
				state.previousAssetTimer = undefined
			}, PREVIOUS_ASSET_TTL_MS)
			state.activeAsset = asset
			state.pendingAsset = undefined
			this.roomReady = true
			if (state.pendingActivation?.assetHash === asset.contentSha256) {
				state.pendingActivation.resolve()
				state.pendingActivation = undefined
			}
			console.info(`TotW lobby ready for tournament ${asset.idTournament}.`)
		})
	}

	private matchesLevelRequest(asset: LoadedAsset, request: LevelRequestPacket) {
		return asset.level.uid === request.uid && asset.level.workshopId === request.workshopId
	}

	private watchLeaderboard(tournamentId: number) {
		if (this.watchedTournamentId === tournamentId) return
		this.watchedTournamentId = tournamentId
		this.standings = undefined
		this.standingsSignature = undefined
		this.leaderboard.watch(tournamentId, (standings) => {
			if (this.watchedTournamentId !== tournamentId) return
			const signature = leaderboardSignature(standings)
			if (signature === this.standingsSignature) return
			this.standings = standings
			this.standingsSignature = signature
			this.queueServerMessage(MESSAGE_CHANGE_DEBOUNCE_MS)
		})
	}

	private queueServerMessage(delayMs: number) {
		if (this.stopped || !this.roomReady || !this.client || !this.asset) return
		if (this.messageDebounceTimer) return
		this.messageDebounceTimer = setTimeout(() => {
			this.messageDebounceTimer = undefined
			const client = this.client
			if (!client) return
			this.messageQueue = this.messageQueue
				.then(() => this.sendServerMessage(client))
				.catch((error) => {
					console.warn(`TotW lobby server message failed: ${safeError(error)}`)
					this.scheduleMessageRefresh(MESSAGE_RETRY_MS)
				})
		}, delayMs)
	}

	private async sendServerMessage(client: LidgrenClient) {
		if (this.stopped || this.client !== client || !this.roomReady || !this.asset) return
		const command = buildTotwServerMessageCommand(
			this.asset.tournamentSlug,
			this.standings,
			this.config.roundTimeSeconds,
		)
		await client.sendReliableOrdered(chatMessagePacket(command))
		this.scheduleMessageRefresh(this.config.messageRefreshMs)
		console.info(`TotW lobby server message sent for tournament ${this.asset.idTournament}.`)
	}

	private scheduleMessageRefresh(delayMs: number) {
		if (this.messageTimer) clearTimeout(this.messageTimer)
		this.messageTimer = setTimeout(() => {
			this.messageTimer = undefined
			this.queueServerMessage(0)
		}, delayMs)
	}

	private clearMessageTimers() {
		if (this.messageTimer) clearTimeout(this.messageTimer)
		if (this.messageDebounceTimer) clearTimeout(this.messageDebounceTimer)
		this.messageTimer = undefined
		this.messageDebounceTimer = undefined
	}

	private async requestAssignment(joinId?: string): Promise<RoomAssignment> {
		const startedAt = performance.now()
		try {
			const response = await tracedFetch(
				`${this.config.brokerUrl}/v1/totw/assignment`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.config.brokerToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(joinId ? { joinId } : {}),
					signal: AbortSignal.timeout(20_000),
				},
				{ operationName: 'lobby.broker.assignment' },
			)
			if (!response.ok) throw new Error(`Room broker returned HTTP ${response.status}`)
			return parseAssignment(await response.json())
		} finally {
			assignmentLatency.record(performance.now() - startedAt)
		}
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		await this.stop()
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
		typeof assignment.port !== 'number' ||
		!Number.isInteger(assignment.port) ||
		assignment.port < 1 ||
		assignment.port > 65_535 ||
		typeof assignment.roomCreated !== 'boolean' ||
		typeof assignment.playerUid !== 'number' ||
		!Number.isInteger(assignment.playerUid) ||
		assignment.playerUid < 0 ||
		assignment.playerUid > 0xffff_ffff ||
		typeof assignment.steamId !== 'string' ||
		!/^[0-9]{17,20}$/.test(assignment.steamId) ||
		typeof assignment.token !== 'string' ||
		assignment.token.length === 0 ||
		assignment.token.length > 4096
	) {
		throw new Error('Room broker response is invalid')
	}
	return {
		host: assignment.host,
		joinId: assignment.joinId,
		playerUid: assignment.playerUid,
		port: assignment.port,
		roomCreated: assignment.roomCreated,
		steamId: assignment.steamId,
		token: assignment.token,
	}
}

async function waitWhileConnected(connection: GameConnection, durationMs: number) {
	const result = await Promise.race([delay(durationMs).then(() => undefined), connection.closed])
	if (result) throw result.error ?? new Error('GameServer connection closed')
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

function createPendingActivation(assetHash: string): PendingActivation {
	let resolve = () => {}
	let reject = (_error: Error) => {}
	const promise = new Promise<void>((complete, fail) => {
		resolve = complete
		reject = fail
	})
	return { assetHash, promise, reject, resolve }
}
