import {
	BitWriter,
	changeLobbyPlaylistPacket,
	changeLobbyVisibilityPacket,
	type GameHostPacket,
	LidgrenClient,
	levelDataPacket,
	type OnlineLevel,
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
const PLAYLIST_CHANGE_DELAY_MS = 3_500
const PROTOCOL_TRANSITION_TIMEOUT_MS = 30_000
const PREVIOUS_ASSET_TTL_MS = 30_000
const MAX_LEVEL_REQUESTS = 8
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
		private readonly playlistChangeDelayMs = PLAYLIST_CHANGE_DELAY_MS,
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
		this.asset = undefined
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
		const transferState: RoomTransferState = {
			queuedUploads: 0,
			uploadQueue: Promise.resolve(),
		}
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
						this.ownsRoom = packet.isHost
						if (!packet.isHost) {
							lostOwnership = true
							replacements.add(1)
							console.warn('TotW lobby ownership unavailable; creating replacement.')
							void client.close('Managed account does not own assigned room')
						}
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
					if (packet.type === 'level-request') {
						if (transferState.queuedUploads >= MAX_LEVEL_REQUESTS) {
							void client.close('Level request queue exceeded capacity')
							return
						}
						transferState.queuedUploads++
						const upload = transferState.uploadQueue
							.then(() => this.uploadRequestedLevel(client, packet, transferState))
							.finally(() => {
								transferState.queuedUploads--
							})
						transferState.uploadQueue = upload.catch(() => {})
						void upload.catch((error) => {
							console.warn(`TotW lobby level upload failed: ${safeError(error)}`)
							void client.close('Failed to supply requested tournament level')
						})
					}
				} catch {
					void client.close('Invalid game server packet')
				}
			},
		})
		this.client = client
		try {
			await client.connect()
			const connectionClosed = client.waitForClose()
			void connectionClosed.then(
				() =>
					transferState.pendingActivation?.reject(
						new Error('GameServer connection closed'),
					),
				(error) =>
					transferState.pendingActivation?.reject(
						error instanceof Error ? error : new Error('GameServer connection closed'),
					),
			)
			this.roomConnected = true
			this.ownsRoom = true
			console.info(
				`TotW lobby GameServer connected; waiting ${this.playlistChangeDelayMs}ms before playlist update.`,
			)
			await Promise.race([delay(this.playlistChangeDelayMs), connectionClosed])
			const activate = (asset: LoadedAsset) =>
				this.activateAsset(client, asset, transferState)
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
				await connectionClosed
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
			if (this.client === client) this.client = undefined
			await client.close()
			if (lostOwnership) await clearManagedLobbyJoinId(MANAGED_LOBBY_KEY)
		}
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
		console.info(`TotW lobby asset ready for tournament ${metadata.idTournament}.`)
	}

	private async activateAsset(
		client: LidgrenClient,
		asset: LoadedAsset,
		state: RoomTransferState,
	) {
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
	}

	private async uploadRequestedLevel(
		client: LidgrenClient,
		request: LevelRequestPacket,
		state: RoomTransferState,
	) {
		const asset = [state.pendingAsset, state.activeAsset, state.previousAsset].find(
			(candidate) => candidate && this.matchesLevelRequest(candidate, request),
		)
		if (!asset) throw new Error('GameServer requested unknown level')

		console.info(`TotW lobby level-data request received for tournament ${asset.idTournament}.`)
		await client.sendReliableOrdered(levelDataPacket(request, asset.compressedData))
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
	}

	private matchesLevelRequest(asset: LoadedAsset, request: LevelRequestPacket) {
		return asset.level.uid === request.uid && asset.level.workshopId === request.workshopId
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

function createPendingActivation(assetHash: string): PendingActivation {
	let resolve = () => {}
	let reject = (_error: Error) => {}
	const promise = new Promise<void>((complete, fail) => {
		resolve = complete
		reject = fail
	})
	return { assetHash, promise, reject, resolve }
}
