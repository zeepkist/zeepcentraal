import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'
import {
	changeLobbyVisibilityPacket,
	type LidgrenClient,
	LidgrenRemoteDisconnectError,
} from '@zeepkist/core/zeepnet'
import { getManagedLobbyJoinId, setManagedLobbyJoinId } from '@zeepkist/database'
import { emitTelemetryLog, withActiveSpan } from '@zeepkist/telemetry'
import type { RoomBrokerClient } from '../broker/roomBrokerClient'
import { resolveChatAuditLine } from '../chat/audit'
import { RoomChat } from '../chat/roomChat'
import { PlayerLeaderboard } from '../leaderboard/playerLeaderboard'
import type { ManagedLobbyProfile, RoomContext, RoomProfileSession } from '../profiles/contracts'
import { createGameClient } from './gameConnection'
import { delay, safeError, withJitter } from './helpers'
import { LevelTransfer } from './levelTransfer'
import { RoomRoster } from './roomRoster'
import {
	afkDisconnects,
	assignmentLatency,
	connectionDuration,
	meter,
	reconnects,
	roomLogger,
} from './telemetry'

export type RuntimeRoomConfig = Omit<ManagedRoomConfig, 'profile'>

export class ManagedLobbyHost {
	private stopped = false
	private client?: LidgrenClient
	private connected = false
	private ready = false
	private ownsRoom = false
	private readonly controller = new AbortController()
	private cancelSession?: () => void
	private readonly attributes: Record<string, string>
	private readonly log: ReturnType<typeof roomLogger>
	constructor(
		private readonly config: RuntimeRoomConfig,
		private readonly broker: Pick<RoomBrokerClient, 'assign'>,
		private readonly profile: ManagedLobbyProfile,
		private readonly protocolTimeoutMs = 30_000,
		private readonly playlistDelayMs = 3_500,
	) {
		this.attributes = { 'room.key': config.key, 'room.profile': profile.name }
		this.log = roomLogger(config.key)
		meter
			.createObservableGauge('zeepkist.managed_room.connected')
			.addCallback((r) => r.observe(this.connected ? 1 : 0, this.attributes))
		meter
			.createObservableGauge('zeepkist.managed_room.ready')
			.addCallback((r) => r.observe(this.ready ? 1 : 0, this.attributes))
		meter
			.createObservableGauge('zeepkist.managed_room.host.owned')
			.addCallback((r) => r.observe(this.ownsRoom ? 1 : 0, this.attributes))
	}
	async run() {
		let retryMs = 1_000
		while (!this.stopped) {
			try {
				const level = await this.profile.prepare()
				if (this.stopped) break
				if (!level) {
					await delay(this.config.assetPollMs, this.controller.signal)
					continue
				}
				await withActiveSpan('lobby.connect', () => this.connectRoom())
				retryMs = 1_000
			} catch (error) {
				if (!this.stopped) {
					reconnects.add(1, this.attributes)
					this.log.warn(`Managed room connection failed; retrying: ${safeError(error)}`)
				}
			}
			if (!this.stopped) {
				await delay(withJitter(retryMs), this.controller.signal)
				retryMs = Math.min(retryMs * 2, this.config.reconnectMaxMs)
			}
		}
	}
	async stop() {
		this.stopped = true
		this.controller.abort()
		this.cancelSession?.()
		const client = this.client
		try {
			if (client) {
				try {
					await client.sendReliableOrdered(changeLobbyVisibilityPacket(false))
				} catch {
					this.log.warn('Managed room could not be made private before shutdown.')
				}
				await client.close('Managed lobby host shutting down')
			}
		} finally {
			this.profile.stop()
		}
	}
	private async connectRoom() {
		const joinId = await getManagedLobbyJoinId(this.config.key)
		const started = performance.now()
		const assignment = await this.broker
			.assign(this.config, joinId)
			.finally(() => assignmentLatency.record(performance.now() - started, this.attributes))
		await setManagedLobbyJoinId(this.config.key, assignment.joinId)
		if (this.stopped) return
		const controller = new AbortController()
		const roster = new RoomRoster()
		const projections = new Set<PlayerLeaderboard>()
		let session: RoomProfileSession | undefined
		let client: LidgrenClient
		const send = async (packet: Uint8Array) => {
			if (controller.signal.aborted || this.client !== client || this.stopped)
				throw new Error('Room connection unavailable')
			await client.sendReliableOrdered(packet)
		}
		const sendAsHost = async (packet: Uint8Array) => {
			if (!this.ownsRoom) throw new Error('Room host authority unavailable')
			await send(packet)
		}
		const transfer = new LevelTransfer(
			send,
			this.config.roundTimeSeconds,
			(event) => {
				if (event.type === 'ready') this.ready = true
				session?.onTransfer(event)
			},
			(error) => {
				this.log.warn(`Level upload failed: ${safeError(error)}`)
				void client.close('Failed to supply requested level')
			},
			this.protocolTimeoutMs,
		)
		const context: RoomContext = {
			signal: controller.signal,
			localSteamId: BigInt(assignment.steamId),
			logger: this.log,
			chat: new RoomChat(sendAsHost),
			getPlayers: () => roster.all(),
			isReady: () => this.ready && !transfer.pending && !controller.signal.aborted,
			isHost: () => this.ownsRoom && !controller.signal.aborted,
			activate: (level) => transfer.activate(level),
			send: sendAsHost,
			createLeaderboard: (onRoster, onError) => {
				const projection = new PlayerLeaderboard(
					async (packet) => {
						if (!context.isHost())
							throw new Error('Room leaderboard connection unavailable')
						await send(packet)
					},
					onRoster,
					onError,
					BigInt(assignment.steamId),
				)
				projections.add(projection)
				return projection
			},
		}
		let cleaned = false
		const cleanup = () => {
			if (cleaned) return
			cleaned = true
			controller.abort()
			try {
				session?.stop()
			} catch (error) {
				this.log.warn(`Room profile cleanup failed: ${safeError(error)}`)
			}
			for (const projection of projections) projection.close()
			transfer.close(this.profile.currentLevel)
			roster.clear()
		}
		this.cancelSession = cleanup
		try {
			session = this.profile.createSession(context)
		} catch (error) {
			cleanup()
			throw error
		}
		client = createGameClient(assignment, (packet) => {
			if (controller.signal.aborted) return
			roster.observe(packet)
			if (packet.type === 'initial') {
				this.ownsRoom = packet.isHost
				if (!packet.isHost) {
					this.log.warn('Ownership unavailable; managed room retained.')
					void client.close('Managed account does not own assigned room')
				}
			}
			if (packet.type === 'master') {
				this.ownsRoom = packet.uid === assignment.playerUid
				if (!this.ownsRoom) {
					this.log.warn('Ownership transferred; managed room retained.')
					void client.close('Managed account lost lobby ownership')
				}
			}
			if (packet.type === 'chat') {
				const line = resolveChatAuditLine(
					this.config.key,
					roster.names(),
					packet.senderUid,
					packet.message,
					assignment.playerUid,
				)
				if (line)
					emitTelemetryLog('info', line, this.attributes, {
						printAttributes: false,
					})
			}
			session?.onPacket(packet)
			if (packet.type === 'level-request') transfer.request(packet)
		})
		this.client = client
		const connectedAt = Date.now()
		try {
			await client.connect()
			const closed = client.waitForClose().then(
				() => ({}) as { error?: Error },
				(error: unknown) => ({
					error: error instanceof Error ? error : new Error('GameServer closed'),
				}),
			)
			void closed.then(({ error }) => {
				const reason =
					error instanceof LidgrenRemoteDisconnectError
						? error.category
						: error
							? 'error'
							: 'local'
				connectionDuration.record(Date.now() - connectedAt, { ...this.attributes, reason })
				if (error instanceof LidgrenRemoteDisconnectError && error.category === 'afk')
					afkDisconnects.add(1, this.attributes)
				cleanup()
			})
			if (this.stopped) return
			await send(changeLobbyVisibilityPacket(this.config.room.isPublic))
			this.log.info(
				`Managed room visibility set to ${this.config.room.isPublic ? 'public' : 'private'}.`,
			)
			this.connected = true
			this.ownsRoom = true
			this.log.info(
				`GameServer connected; waiting ${this.playlistDelayMs}ms before playlist update.`,
			)
			const duringDelay = await Promise.race([
				delay(this.playlistDelayMs, controller.signal).then(() => undefined),
				closed,
			])
			if (duringDelay) throw duringDelay.error ?? new Error('GameServer connection closed')
			if (controller.signal.aborted) return
			await session.start()
			const result = await closed
			if (result.error) throw result.error
		} finally {
			cleanup()
			this.connected = this.ready = this.ownsRoom = false
			if (this.cancelSession === cleanup) this.cancelSession = undefined
			if (this.client === client) this.client = undefined
			await client.close('Managed room reconnecting')
		}
	}
	async [Symbol.asyncDispose]() {
		await this.stop()
	}
}
