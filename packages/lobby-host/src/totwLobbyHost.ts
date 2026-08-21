import { createHash } from 'node:crypto'
import {
	BitWriter,
	changeLobbyPlaylistPacket,
	changeLobbyVisibilityPacket,
	LidgrenClient,
	levelDataPacket,
	type OnlineLevel,
	parseGameHostPacket,
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

export class TotwLobbyHost {
	private stopped = false
	private client: LidgrenClient | undefined
	private asset: LoadedAsset | undefined
	private refreshPromise: Promise<void> | undefined
	private roomConnected = false
	private ownsRoom = false

	constructor(private readonly config: HostConfig) {
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
		let lostOwnership = false
		const client = new LidgrenClient({
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
					if (packet.type === 'playlist-index' && packet.selectNext) {
						void this.sendPlaylist(client).catch(() =>
							client.close('Failed to update lobby playlist'),
						)
						return
					}
					if (packet.type === 'level-request') {
						void this.sendLevelData(client, packet).catch(() =>
							client.close('Failed to send lobby level data'),
						)
					}
				} catch {
					void client.close('Invalid game server packet')
				}
			},
		})
		this.client = client
		try {
			await client.connect()
			const isHost = await withTimeout(initialState, INITIAL_STATE_TIMEOUT_MS)
			if (!isHost) {
				await clearManagedLobbyJoinId(MANAGED_LOBBY_KEY)
				throw new Error('Managed account no longer owns assigned room')
			}
			this.roomConnected = true
			this.ownsRoom = true
			await this.sendPlaylist(client)
			console.info(`TotW lobby host connected for tournament ${this.asset?.idTournament}.`)
			const assetTimer = setInterval(() => {
				void this.refreshAndPublish(client).catch((error) => {
					console.warn(`TotW lobby asset refresh failed: ${safeError(error)}`)
				})
			}, this.config.assetPollMs)
			try {
				await client.waitForClose()
			} finally {
				clearInterval(assetTimer)
			}
		} finally {
			this.roomConnected = false
			this.ownsRoom = false
			if (this.client === client) this.client = undefined
			await client.close()
			if (lostOwnership) await clearManagedLobbyJoinId(MANAGED_LOBBY_KEY)
		}
	}

	private async refreshAndPublish(client: LidgrenClient) {
		const previousHash = this.asset?.contentSha256
		await this.refreshAsset()
		if (this.asset && this.asset.contentSha256 !== previousHash) await this.sendPlaylist(client)
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

	private sendPlaylist(client: LidgrenClient) {
		const asset = this.asset
		if (!asset) return Promise.resolve()
		return client.sendReliableOrdered(
			changeLobbyPlaylistPacket(asset.level, this.config.roundTimeSeconds),
		)
	}

	private sendLevelData(client: LidgrenClient, request: { uid: string; workshopId: bigint }) {
		const asset = this.asset
		if (
			!asset ||
			request.uid !== asset.level.uid ||
			request.workshopId !== asset.level.workshopId
		) {
			return Promise.resolve()
		}
		return client.sendReliableOrdered(levelDataPacket(asset.level, asset.compressedData))
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
	let timer: ReturnType<typeof setTimeout> | undefined
	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error('Initial game state timed out')),
					timeoutMs,
				)
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
