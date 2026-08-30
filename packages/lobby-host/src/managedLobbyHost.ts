import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
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
	TRACK_TOURNAMENT_TYPE,
} from '@zeepkist/database'
import { emitTelemetryLog, getMeter, withActiveSpan } from '@zeepkist/telemetry'
import type { LevelPayloadCache, LevelPayloadLease } from './levelPayloadCache'
import type { RoomAssignment, RoomBrokerClient } from './roomBrokerClient'
import type { TrackTournamentLeaderboardHub } from './trackTournamentLeaderboard'
import {
	buildTrackTournamentJoinMessageCommand,
	buildTrackTournamentServerMessageCommand,
	leaderboardSignature,
	type TrackTournamentLeaderboardStanding,
} from './trackTournamentMessages'

const PLAYLIST_CHANGE_DELAY_MS = 3_500
const PROTOCOL_TRANSITION_TIMEOUT_MS = 30_000
const PREVIOUS_ASSET_TTL_MS = 30_000
const MAX_LEVEL_REQUESTS = 8
const MAX_ASSET_BYTES = 64 * 1024 * 1024
const MESSAGE_CHANGE_DEBOUNCE_MS = 1_000
const MESSAGE_RETRY_MS = 30_000
const ANSI_SEQUENCE_PATTERN = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, 'g')
const meter = getMeter('zeepcentraal-lobby-host')
const assignmentLatency = meter.createHistogram('zeepkist.managed_room.assignment.duration', {
	description: 'Room broker assignment latency',
	unit: 'ms',
})
const reconnects = meter.createCounter('zeepkist.managed_room.reconnects', {
	description: 'Failed room connections followed by retry',
})
const connectionDuration = meter.createHistogram('zeepkist.managed_room.connection.duration', {
	description: 'GameServer connection lifetime',
	unit: 'ms',
})
const afkDisconnects = meter.createCounter('zeepkist.managed_room.disconnects.afk', {
	description: 'GameServer disconnects categorized as AFK',
})

interface LoadedAsset {
	compressedData: Uint8Array
	contentSha256: string
	idTournament: number
	lease: LevelPayloadLease
	level: OnlineLevel
	tournamentEndAt: string
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

export interface ManagedLobbyProfile {
	tournamentType: 'monthly' | 'weekly'
	type: 'track-tournament'
}

interface SharedResources {
	broker: RoomBrokerClient
	leaderboard: TrackTournamentLeaderboardHub
	payloads: LevelPayloadCache
}

export class ManagedLobbyHost {
	private stopped = false
	private client: LidgrenClient | undefined
	private asset: LoadedAsset | undefined
	private refreshPromise: Promise<void> | undefined
	private roomConnected = false
	private roomReady = false
	private ownsRoom = false
	private standings: TrackTournamentLeaderboardStanding[] | undefined
	private standingsSignature: string | undefined
	private watchedTournamentId: number | undefined
	private messageTimer: ReturnType<typeof setTimeout> | undefined
	private messageDebounceTimer: ReturnType<typeof setTimeout> | undefined
	private messageQueue = Promise.resolve()
	private stopLeaderboardWatch: (() => void) | undefined
	private readonly players = new Map<number, string>()
	private readonly ownedAssets = new Set<LoadedAsset>()
	private readonly metricAttributes: Record<string, string>
	private readonly stopController = new AbortController()

	constructor(
		private readonly config: ManagedRoomConfig,
		private readonly shared: SharedResources,
		private readonly protocolTransitionTimeoutMs = PROTOCOL_TRANSITION_TIMEOUT_MS,
		private readonly playlistChangeDelayMs = PLAYLIST_CHANGE_DELAY_MS,
	) {
		this.metricAttributes = {
			'room.key': config.key,
			'room.profile': this.profileName,
		}
		meter
			.createObservableGauge('zeepkist.track_tournament.asset.ready')
			.addCallback((result) => result.observe(this.asset ? 1 : 0, this.metricAttributes))
		meter
			.createObservableGauge('zeepkist.track_tournament.active')
			.addCallback((result) =>
				result.observe(this.asset?.idTournament ?? 0, this.metricAttributes),
			)
		meter
			.createObservableGauge('zeepkist.managed_room.connected')
			.addCallback((result) =>
				result.observe(this.roomConnected ? 1 : 0, this.metricAttributes),
			)
		meter
			.createObservableGauge('zeepkist.managed_room.ready')
			.addCallback((result) => result.observe(this.roomReady ? 1 : 0, this.metricAttributes))
		meter
			.createObservableGauge('zeepkist.managed_room.host.owned')
			.addCallback((result) => result.observe(this.ownsRoom ? 1 : 0, this.metricAttributes))
	}

	private get profileName() {
		return `${this.config.profile.type}.${this.config.profile.tournamentType}`
	}

	async run() {
		let retryMs = 1_000
		while (!this.stopped) {
			try {
				await this.refreshAsset()
				if (this.stopped) break
				if (!this.asset) {
					this.warn('Tournament asset unavailable; waiting before room assignment.')
					await delay(this.config.assetPollMs, this.stopController.signal)
					continue
				}
				await withActiveSpan('lobby.connect', () => this.connectRoom())
				retryMs = 1_000
			} catch (error) {
				if (!this.stopped) {
					reconnects.add(1, this.metricAttributes)
					this.warn(`Managed room connection failed; retrying: ${safeError(error)}`)
				}
			}
			if (!this.stopped) {
				await delay(withJitter(retryMs), this.stopController.signal)
				retryMs = Math.min(retryMs * 2, this.config.reconnectMaxMs)
			}
		}
	}

	async stop() {
		this.stopped = true
		this.stopController.abort()
		this.clearMessageTimers()
		const client = this.client
		if (client) {
			try {
				await client.sendReliableOrdered(changeLobbyVisibilityPacket(false))
			} catch {
				this.warn('Managed room could not be made private before shutdown.')
			}
		}
		try {
			await client?.close('Managed lobby host shutting down')
		} finally {
			this.stopLeaderboardWatch?.()
			this.stopLeaderboardWatch = undefined
			for (const asset of this.ownedAssets) asset.lease.release()
			this.ownedAssets.clear()
			this.asset = undefined
		}
	}

	private async connectRoom() {
		const joinId = await getManagedLobbyJoinId(this.config.key)
		const assignment = await this.requestAssignment(joinId)
		await setManagedLobbyJoinId(this.config.key, assignment.joinId)
		const transferState: RoomTransferState = {
			queuedUploads: 0,
			uploadQueue: Promise.resolve(),
		}
		const active = await this.createGameConnection(assignment, transferState)
		this.client = active.client
		try {
			if (this.stopped) {
				try {
					await active.client.sendReliableOrdered(changeLobbyVisibilityPacket(false))
				} catch {
					this.warn('Managed room could not be made private during startup shutdown.')
				}
				return
			}
			this.roomConnected = true
			this.ownsRoom = true
			this.info(
				`GameServer connected; waiting ${this.playlistChangeDelayMs}ms before playlist update.`,
			)
			await waitWhileConnected(active, this.playlistChangeDelayMs)
			const activate = (asset: LoadedAsset) =>
				this.activateAsset(active.client, asset, transferState)
			const initialAsset = this.asset
			if (!initialAsset) throw new Error('Tournament asset became unavailable')
			await activate(initialAsset)
			if (assignment.roomCreated) {
				await active.client.sendReliableOrdered(
					chatMessagePacket(
						buildTrackTournamentJoinMessageCommand(this.config.profile.tournamentType),
					),
				)
				this.info('Join message configured.')
			}
			await this.sendServerMessage(active.client)
			this.info(`Managed room connected for tournament ${initialAsset.idTournament}.`)
			let refreshing = false
			const assetTimer = setInterval(() => {
				if (refreshing) return
				refreshing = true
				void this.refreshAndPublish(activate)
					.catch((error) => this.warn(`Asset refresh failed: ${safeError(error)}`))
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
			for (const asset of new Set([
				transferState.pendingAsset,
				transferState.previousAsset,
				transferState.activeAsset,
			])) {
				if (asset && asset !== this.asset) this.releaseAsset(asset)
			}
			transferState.pendingAsset = undefined
			transferState.previousAsset = undefined
			transferState.activeAsset = undefined
			this.roomConnected = false
			this.roomReady = false
			this.ownsRoom = false
			this.players.clear()
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
						this.players.clear()
						for (const player of packet.players)
							this.players.set(player.uid, displayPlayerName(player))
						if (packet.isHost) this.ownsRoom = true
						else {
							this.ownsRoom = false
							this.warn('Ownership unavailable; managed room retained.')
							void client.close('Managed account does not own assigned room')
						}
						return
					}
					if (packet.type === 'player-connected') {
						this.players.set(packet.uid, displayPlayerName(packet))
						return
					}
					if (packet.type === 'player-disconnected') {
						this.players.delete(packet.uid)
						return
					}
					if (packet.type === 'chat') {
						this.auditChat(packet.senderUid, packet.message, assignment.playerUid)
						return
					}
					if (packet.type === 'master') {
						if (packet.uid === assignment.playerUid) this.ownsRoom = true
						else if (this.client === client) {
							this.ownsRoom = false
							this.warn('Ownership transferred; managed room retained.')
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
			connectionDuration.record(Date.now() - connectedAt, {
				...this.metricAttributes,
				reason,
			})
			if (error instanceof LidgrenRemoteDisconnectError && error.category === 'afk') {
				afkDisconnects.add(1, this.metricAttributes)
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
			this.warn(`Level upload failed: ${safeError(error)}`)
			void client.close('Failed to supply requested tournament level')
		})
	}

	private async refreshAndPublish(activate: (asset: LoadedAsset) => Promise<void>) {
		await this.refreshAsset()
		if (!this.stopped && this.asset) await activate(this.asset)
	}

	private async refreshAsset() {
		this.refreshPromise ??= this.refreshAssetOnce().finally(() => {
			this.refreshPromise = undefined
		})
		return this.refreshPromise
	}

	private async refreshAssetOnce() {
		return withActiveSpan('lobby.asset.refresh', async (span) => {
			const tournamentType =
				this.config.profile.tournamentType === 'weekly'
					? TRACK_TOURNAMENT_TYPE.weekly
					: TRACK_TOURNAMENT_TYPE.monthly
			const metadata = await getPreferredTrackTournamentLobbyAsset(tournamentType)
			if (this.stopped) return
			if (!metadata || metadata.contentSha256 === this.asset?.contentSha256) return
			if (metadata.byteSize < 1 || metadata.byteSize > MAX_ASSET_BYTES) {
				throw new Error('Prepared tournament asset size is invalid')
			}
			const lease = await this.shared.payloads.acquire(metadata.contentSha256, () =>
				downloadTrackTournamentLobbyAsset(metadata),
			)
			if (this.stopped) {
				lease.release()
				return
			}
			const nextAsset: LoadedAsset = {
				compressedData: lease.data,
				contentSha256: metadata.contentSha256,
				idTournament: metadata.idTournament,
				lease,
				tournamentEndAt: metadata.tournamentEndAt,
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
			this.asset = nextAsset
			this.ownedAssets.add(nextAsset)
			this.watchLeaderboard(metadata.idTournament)
			span.addEvent('lobby.asset.ready', {
				'lobby.asset.bytes': lease.data.byteLength,
			})
			this.info(`Asset ready for tournament ${metadata.idTournament}.`)
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
			this.info(`Playlist and level switch sent for tournament ${asset.idTournament}.`)
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

			this.info(`Level-data request received for tournament ${asset.idTournament}.`)
			await client.sendReliableOrdered(levelDataPacket(request, asset.compressedData))
			span.addEvent('lobby.asset.uploaded', {
				'lobby.asset.bytes': asset.compressedData.length,
			})
			this.info(
				`Level data uploaded for tournament ${asset.idTournament} (${asset.compressedData.length} bytes).`,
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
				if (state.previousAsset === previousAsset) {
					state.previousAsset = undefined
					if (previousAsset) this.releaseAsset(previousAsset)
				}
				state.previousAssetTimer = undefined
			}, PREVIOUS_ASSET_TTL_MS)
			state.activeAsset = asset
			state.pendingAsset = undefined
			this.roomReady = true
			if (state.pendingActivation?.assetHash === asset.contentSha256) {
				state.pendingActivation.resolve()
				state.pendingActivation = undefined
			}
			this.info(`Ready for tournament ${asset.idTournament}.`)
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
		this.stopLeaderboardWatch?.()
		this.stopLeaderboardWatch = this.shared.leaderboard.watch(
			this.config.key,
			tournamentId,
			(standings) => {
				if (this.watchedTournamentId !== tournamentId) return
				const signature = leaderboardSignature(standings)
				if (signature === this.standingsSignature) return
				this.standings = standings
				this.standingsSignature = signature
				this.queueServerMessage(MESSAGE_CHANGE_DEBOUNCE_MS)
			},
		)
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
					this.warn(`Server message failed: ${safeError(error)}`)
					this.scheduleMessageRefresh(MESSAGE_RETRY_MS)
				})
		}, delayMs)
	}

	private async sendServerMessage(client: LidgrenClient) {
		if (this.stopped || this.client !== client || !this.roomReady || !this.asset) return
		const command = buildTrackTournamentServerMessageCommand(
			this.config.profile.tournamentType,
			this.asset.tournamentSlug,
			this.asset.tournamentEndAt,
			this.standings,
			this.config.roundTimeSeconds,
		)
		await client.sendReliableOrdered(chatMessagePacket(command))
		this.scheduleMessageRefresh(this.config.messageRefreshMs)
		this.info(`Server message sent for tournament ${this.asset.idTournament}.`)
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
			return await this.shared.broker.assign(this.config, joinId)
		} finally {
			assignmentLatency.record(performance.now() - startedAt, this.metricAttributes)
		}
	}

	private releaseAsset(asset: LoadedAsset) {
		asset.lease.release()
		this.ownedAssets.delete(asset)
	}

	private auditChat(senderUid: number, message: string, localUid: number) {
		const line = resolveChatAuditLine(
			this.config.key,
			this.players,
			senderUid,
			message,
			localUid,
		)
		if (!line) return
		emitTelemetryLog('info', line, this.metricAttributes, { printAttributes: false })
	}

	private info(message: string) {
		console.info(`[${this.config.key}] ${message}`)
	}

	private warn(message: string) {
		console.warn(`[${this.config.key}] ${message}`)
	}

	public async [Symbol.asyncDispose](): Promise<void> {
		await this.stop()
	}
}

function displayPlayerName(player: { backupName: string; playerTag: string; username?: string }) {
	return `${player.playerTag}${player.username?.trim() || player.backupName}`
}

function sanitizeAuditText(value: string, maxLength: number, fallback: string) {
	const sanitized = value
		.replace(ANSI_SEQUENCE_PATTERN, '')
		.replace(/[\p{Cc}\p{Cf}]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim()
	let result = ''
	for (const character of sanitized) {
		if (result.length + character.length > maxLength) break
		result += character
	}
	return result || fallback
}

export function formatChatAuditLine(roomKey: string, playerName: string, message: string) {
	return `[chat] [${roomKey}] ${sanitizeAuditText(playerName, 256, 'Unknown player')}: ${sanitizeAuditText(message, 3_700, '[empty]')}`
}

export function resolveChatAuditLine(
	roomKey: string,
	players: ReadonlyMap<number, string>,
	senderUid: number,
	message: string,
	localUid: number,
) {
	if (senderUid === 0 || senderUid === localUid) return undefined
	return formatChatAuditLine(
		roomKey,
		players.get(senderUid) ?? `Unknown player ${senderUid}`,
		message,
	)
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

function delay(ms: number, signal?: AbortSignal) {
	if (signal?.aborted) return Promise.resolve()
	return new Promise<void>((resolve) => {
		const timer = setTimeout(complete, ms)
		function complete() {
			clearTimeout(timer)
			signal?.removeEventListener('abort', complete)
			resolve()
		}
		signal?.addEventListener('abort', complete, { once: true })
	})
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
