import {
	BitWriter,
	changeLobbyPlaylistPacket,
	changeLobbyVisibilityPacket,
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

const MANAGED_LOBBY_KEY = 'totw'
const PLAYLIST_CHANGE_DELAY_MS = 3_500
const PROTOCOL_TRANSITION_TIMEOUT_MS = 30_000
const PREVIOUS_ASSET_TTL_MS = 30_000
const MAX_LEVEL_REQUESTS = 8
const MAX_ASSET_BYTES = 64 * 1024 * 1024
const DEFAULT_CREDENTIAL_REFRESH_MS = 50 * 60_000
const DEFAULT_CREDENTIAL_DEADLINE_MS = 60 * 60_000
const CREDENTIAL_REQUEST_TIMEOUT_MS = 30_000
const CREDENTIAL_RETRY_MIN_MS = 30_000
const CREDENTIAL_RETRY_MAX_MS = 5 * 60_000
const meter = getMeter('zeepcentraal-lobby-host')
const assignmentLatency = meter.createHistogram('zeepkist.totw.assignment.duration', {
	description: 'Room broker assignment latency',
	unit: 'ms',
})
const reconnects = meter.createCounter('zeepkist.totw.reconnects', {
	description: 'Failed room connections followed by retry',
})
const credentialRefreshes = meter.createCounter('zeepkist.totw.credential.refreshes', {
	description: 'GameServer credential handoff attempts',
})
const connectionDuration = meter.createHistogram('zeepkist.totw.connection.duration', {
	description: 'GameServer connection lifetime',
	unit: 'ms',
})
const credentialAge = meter.createHistogram('zeepkist.totw.credential.age', {
	description: 'GameServer credential age when connection closes',
	unit: 'ms',
})

interface HostConfig {
	assetPollMs: number
	brokerToken: string
	brokerUrl: string
	reconnectMaxMs: number
	roundTimeSeconds: number
}

interface RoomCredential {
	credentialDeadlineAt: number
	credentialGeneration: number
	credentialIssuedAt: number
	credentialRefreshAt: number
	playerUid: number
	steamId: string
	token: string
}

interface RoomAssignment extends RoomCredential {
	host: string
	joinId: string
	port: number
}

interface LoadedAsset {
	compressedData: Uint8Array
	contentSha256: string
	idTournament: number
	level: OnlineLevel
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
	pendingActivation?: PendingActivation
	pendingAsset?: LoadedAsset
	previousAsset?: LoadedAsset
	previousAssetTimer?: ReturnType<typeof setTimeout>
	queuedUploads: number
	uploadQueue: Promise<void>
}

interface GameConnection {
	assignment: RoomAssignment
	client: LidgrenClient
	closed: Promise<{ error?: Error }>
	connectedAt: number
}

export class TotwLobbyHost {
	private stopped = false
	private client: LidgrenClient | undefined
	private readonly clients = new Set<LidgrenClient>()
	private asset: LoadedAsset | undefined
	private refreshPromise: Promise<void> | undefined
	private roomConnected = false
	private roomReady = false
	private ownsRoom = false

	constructor(
		private readonly config: HostConfig,
		private readonly protocolTransitionTimeoutMs = PROTOCOL_TRANSITION_TIMEOUT_MS,
		private readonly playlistChangeDelayMs = PLAYLIST_CHANGE_DELAY_MS,
	) {
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
		const client = this.client
		this.asset = undefined
		if (client) {
			try {
				await client.sendReliableOrdered(changeLobbyVisibilityPacket(false))
			} catch {
				console.warn('TotW lobby host could not make room private before shutdown.')
			}
		}
		await Promise.all(
			[...this.clients].map((connection) =>
				connection.close('TotW lobby host shutting down'),
			),
		)
	}

	private async connectRoom() {
		const joinId = await getManagedLobbyJoinId(MANAGED_LOBBY_KEY)
		const assignment = await this.requestAssignment(joinId)
		await setManagedLobbyJoinId(MANAGED_LOBBY_KEY, assignment.joinId)
		const transferState: RoomTransferState = {
			queuedUploads: 0,
			uploadQueue: Promise.resolve(),
		}
		const localPlayerUids = new Set([assignment.playerUid])
		let active = await this.createGameConnection(
			assignment,
			transferState,
			localPlayerUids,
			false,
		)
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
				let credentialRetryMs = CREDENTIAL_RETRY_MIN_MS
				let nextCredentialAttemptAt = active.assignment.credentialRefreshAt
				while (!this.stopped) {
					const watched = active
					const outcome = await Promise.race([
						watched.closed.then((closed) => ({ type: 'closed' as const, closed })),
						delay(Math.max(0, nextCredentialAttemptAt - Date.now())).then(() => ({
							type: 'refresh' as const,
						})),
					])
					try {
						active = await this.refreshGameConnection(
							watched,
							transferState,
							localPlayerUids,
						)
						credentialRetryMs = CREDENTIAL_RETRY_MIN_MS
						nextCredentialAttemptAt = active.assignment.credentialRefreshAt
					} catch (error) {
						if (outcome.type === 'closed') throw outcome.closed.error ?? error
						console.warn(
							`TotW lobby credential handoff failed; current connection retained: ${safeError(error)}`,
						)
						nextCredentialAttemptAt = Date.now() + withJitter(credentialRetryMs)
						credentialRetryMs = Math.min(credentialRetryMs * 2, CREDENTIAL_RETRY_MAX_MS)
					}
				}
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
			if (this.client === active.client) this.client = undefined
			await Promise.all(
				[...this.clients].map((connection) =>
					connection.close('Managed room reconnecting'),
				),
			)
		}
	}

	private async createGameConnection(
		assignment: RoomAssignment,
		state: RoomTransferState,
		localPlayerUids: Set<number>,
		requireAuthority: boolean,
	): Promise<GameConnection> {
		const hail = new BitWriter()
		hail.writeString(assignment.token)
		let authorityResolved = false
		let resolveAuthority = () => {}
		let rejectAuthority = (_error: Error) => {}
		const authority = new Promise<void>((resolve, reject) => {
			resolveAuthority = resolve
			rejectAuthority = reject
		})
		if (!requireAuthority) void authority.catch(() => undefined)
		const markAuthority = () => {
			if (authorityResolved) return
			authorityResolved = true
			this.ownsRoom = true
			resolveAuthority()
		}
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
						if (packet.isHost) markAuthority()
						else if (!requireAuthority) {
							this.ownsRoom = false
							console.warn('TotW lobby ownership unavailable; managed room retained.')
							void client.close('Managed account does not own assigned room')
						}
						return
					}
					if (packet.type === 'master') {
						if (packet.uid === assignment.playerUid) markAuthority()
						else if (localPlayerUids.has(packet.uid)) return
						else if (this.client === client) {
							this.ownsRoom = false
							console.warn('TotW lobby ownership transferred; managed room retained.')
							void client.close('Managed account lost lobby ownership')
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
		this.clients.add(client)
		const connectedAt = Date.now()
		try {
			await client.connect()
		} catch (error) {
			this.clients.delete(client)
			throw error
		}
		const closed: Promise<{ error?: Error }> = client.waitForClose().then(
			() => ({}),
			(error) => ({ error: error instanceof Error ? error : new Error('GameServer closed') }),
		)
		void closed.then(({ error }) => {
			this.clients.delete(client)
			connectionDuration.record(Date.now() - connectedAt)
			credentialAge.record(Date.now() - assignment.credentialIssuedAt, {
				reason: error instanceof LidgrenRemoteDisconnectError ? error.category : 'local',
			})
			rejectAuthority(error ?? new Error('GameServer connection closed'))
			if (this.client === client) {
				state.pendingActivation?.reject(error ?? new Error('GameServer connection closed'))
			}
		})
		if (requireAuthority) {
			try {
				await withTimeout(
					authority,
					this.protocolTransitionTimeoutMs,
					'Successor GameServer connection did not receive host authority',
				)
			} catch (error) {
				await client.close('Successor connection did not receive host authority')
				throw error
			}
		}
		return { assignment, client, closed, connectedAt }
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

	private async refreshGameConnection(
		current: GameConnection,
		state: RoomTransferState,
		localPlayerUids: Set<number>,
	) {
		credentialRefreshes.add(1)
		const credential = await this.requestCredential(current.assignment.credentialGeneration)
		if (credential.credentialGeneration <= current.assignment.credentialGeneration) {
			throw new Error('Room broker returned stale credential')
		}
		if (credential.steamId !== current.assignment.steamId) {
			throw new Error('Room broker returned credential for different account')
		}
		const successorAssignment = { ...current.assignment, ...credential }
		localPlayerUids.add(credential.playerUid)
		let successor: GameConnection
		try {
			successor = await this.createGameConnection(
				successorAssignment,
				state,
				localPlayerUids,
				true,
			)
		} catch (error) {
			if (credential.playerUid !== current.assignment.playerUid) {
				localPlayerUids.delete(credential.playerUid)
			}
			throw error
		}
		this.client = successor.client
		await current.client.close('Room credential handoff complete')
		if (credential.playerUid !== current.assignment.playerUid) {
			localPlayerUids.delete(current.assignment.playerUid)
		}
		console.info('TotW lobby GameServer credential refreshed without playlist reset.')
		return successor
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
				level: {
					author: metadata.author,
					collaborators: metadata.collaborators,
					name: metadata.levelName,
					overrideAuthorName: metadata.overrideAuthorName,
					uid: metadata.fileUid,
					workshopId: metadata.workshopId,
				},
			}
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

	private async requestCredential(currentGeneration: number): Promise<RoomCredential> {
		const deadline = Date.now() + CREDENTIAL_REQUEST_TIMEOUT_MS
		while (Date.now() < deadline) {
			const response = await tracedFetch(
				`${this.config.brokerUrl}/v1/totw/credential`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${this.config.brokerToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ credentialGeneration: currentGeneration }),
					signal: AbortSignal.timeout(Math.min(20_000, deadline - Date.now())),
				},
				{ operationName: 'lobby.broker.credential' },
			)
			if (response.status === 202) {
				const retrySeconds = Number.parseInt(response.headers.get('retry-after') ?? '1', 10)
				await delay(Math.min(5_000, Math.max(250, (retrySeconds || 1) * 1_000)))
				continue
			}
			if (!response.ok) throw new Error(`Room broker returned HTTP ${response.status}`)
			return parseCredential(await response.json())
		}
		throw new Error('Room broker credential refresh timed out')
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
		assignment.port > 65_535
	) {
		throw new Error('Room broker response is invalid')
	}
	return {
		host: assignment.host,
		joinId: assignment.joinId,
		port: assignment.port,
		...parseCredentialFields(assignment, true),
	}
}

function parseCredential(value: unknown): RoomCredential {
	if (typeof value !== 'object' || value === null)
		throw new Error('Room broker response is invalid')
	return parseCredentialFields(value as Partial<RoomCredential>, false)
}

function parseCredentialFields(
	credential: Partial<RoomCredential>,
	allowLegacyTiming: boolean,
): RoomCredential {
	if (
		typeof credential.playerUid !== 'number' ||
		!Number.isInteger(credential.playerUid) ||
		credential.playerUid < 0 ||
		credential.playerUid > 0xffff_ffff ||
		typeof credential.steamId !== 'string' ||
		!/^[0-9]{17,20}$/.test(credential.steamId) ||
		typeof credential.token !== 'string' ||
		credential.token.length === 0 ||
		credential.token.length > 4096
	) {
		throw new Error('Room broker response is invalid')
	}
	if (
		allowLegacyTiming &&
		credential.credentialGeneration === undefined &&
		credential.credentialIssuedAt === undefined &&
		credential.credentialRefreshAt === undefined &&
		credential.credentialDeadlineAt === undefined
	) {
		const credentialIssuedAt = Date.now()
		return {
			credentialDeadlineAt: credentialIssuedAt + DEFAULT_CREDENTIAL_DEADLINE_MS,
			credentialGeneration: 0,
			credentialIssuedAt,
			credentialRefreshAt: credentialIssuedAt + DEFAULT_CREDENTIAL_REFRESH_MS,
			playerUid: credential.playerUid,
			steamId: credential.steamId,
			token: credential.token,
		}
	}
	if (
		!isEpochMs(credential.credentialIssuedAt) ||
		!isEpochMs(credential.credentialRefreshAt) ||
		!isEpochMs(credential.credentialDeadlineAt) ||
		typeof credential.credentialGeneration !== 'number' ||
		!Number.isSafeInteger(credential.credentialGeneration) ||
		credential.credentialGeneration < 0 ||
		credential.credentialIssuedAt > credential.credentialRefreshAt ||
		credential.credentialRefreshAt >= credential.credentialDeadlineAt
	) {
		throw new Error('Room broker response is invalid')
	}
	return credential as RoomCredential
}

function isEpochMs(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
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
