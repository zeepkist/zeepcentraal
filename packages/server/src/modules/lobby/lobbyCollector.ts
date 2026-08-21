import type { LobbySnapshot } from '@zeepkist/core'
import {
	BitReader,
	BitWriter,
	createLobbyPacket,
	joinLobbyPacket,
	LidgrenClient,
	type MasterRoomResponse,
	parseLobbyPacket,
	parseMasterRoomResponse,
} from '@zeepkist/core/zeepnet'
import { getMeter } from '@zeepkist/telemetry'
import { LobbyPersistenceQueue, type PersistLobbyPacket } from './lobbyPersistenceQueue'
import { LobbyState } from './lobbyState'
import { LobbySteamSession, type SteamIdentity } from './steamSession'

interface LobbyCollectorConfig {
	appId: number
	build: number
	host: string
	port: number
	refreshTokenFile: string
	room: {
		isPublic: boolean
		maxPlayers: number
		name: string
	}
}

const MIN_TICKET_INTERVAL_MS = 60_000
const FIRST_SNAPSHOT_TIMEOUT_MS = 15_000
const ROOM_RESPONSE_TIMEOUT_MS = 15_000
const meter = getMeter('zeepcentraal-lobby-collector')
const assignmentLatency = meter.createHistogram('zeepkist.lobby.assignment.duration', {
	description: 'Master room assignment latency',
	unit: 'ms',
})
const reconnects = meter.createCounter('zeepkist.lobby.master.reconnects', {
	description: 'Failed master connections followed by retry',
})

export interface RoomAssignment {
	host: string
	joinId: string
	playerUid: number
	port: number
	steamId: string
	token: string
}

export class LobbyCollector {
	private stopped = false
	private lidgren: LidgrenClient | undefined
	private steam: LobbySteamSession | undefined
	private lastSnapshot: LobbySnapshot | undefined
	private cachedTicket: Buffer | undefined
	private ticketCreatedAt = 0
	private lastTicketRequestAt = 0
	private stopPromise: Promise<void> | undefined
	private identity: SteamIdentity | undefined
	private masterPlayerUid: number | undefined
	private masterToken: string | undefined
	private roomAssignmentPromise: Promise<RoomAssignment> | undefined
	private masterConnected = false
	private readonly roomResponses = new RoomResponseInbox()
	private readonly persistence: LobbyPersistenceQueue

	constructor(
		private readonly config: LobbyCollectorConfig,
		private readonly publish: (snapshot: LobbySnapshot) => void,
		persist: PersistLobbyPacket,
	) {
		this.persistence = new LobbyPersistenceQueue(persist, () => {
			console.warn('Zeepkist lobby persistence failed; live feed continuing')
		})
		meter
			.createObservableGauge('zeepkist.lobby.master.connected')
			.addCallback((result) => result.observe(this.masterConnected ? 1 : 0))
	}

	start() {
		this.publish(emptySnapshot('connecting'))
		void this.run()
	}

	stop() {
		this.stopped = true
		this.stopPromise ??= this.stopConnections()
		return this.stopPromise
	}

	assignRoom(existingJoinId?: string) {
		if (!this.roomAssignmentPromise) {
			const startedAt = performance.now()
			this.roomAssignmentPromise = this.assignRoomOnce(existingJoinId).finally(() => {
				assignmentLatency.record(performance.now() - startedAt)
				this.roomAssignmentPromise = undefined
			})
		}
		return this.roomAssignmentPromise
	}

	private async run() {
		let retry = 1_000
		try {
			this.steam = new LobbySteamSession(this.config.refreshTokenFile, this.config.appId)
			const identity = await this.steam.connect()
			this.identity = identity
			while (!this.stopped) {
				try {
					await this.connectToMaster(identity)
					retry = 1_000
				} catch (error) {
					if (!this.stopped) {
						reconnects.add(1)
						console.warn(
							`Zeepkist lobby collector connection failed; retrying: ${safeErrorMessage(error)}`,
						)
					}
				}
				if (this.stopped) {
					break
				}
				this.markStale()
				await delay(withJitter(retry))
				retry = Math.min(retry * 2, 60_000)
			}
		} catch {
			if (!this.stopped) {
				console.error('Zeepkist lobby collector could not start Steam session')
				this.publish(emptySnapshot('unavailable'))
			}
		}
	}

	private async connectToMaster(identity: SteamIdentity) {
		const ticket = await this.getTicket()
		if (this.stopped) {
			return
		}
		const state = new LobbyState()
		let invalidPacket = false
		let firstSnapshotTimedOut = false
		let firstSnapshotTimer: ReturnType<typeof setTimeout> | undefined
		const lidgren = new LidgrenClient({
			host: this.config.host,
			port: this.config.port,
			hail: createHail(this.config.build, identity, ticket),
			onConnected: (remoteHail) => {
				const reader = new BitReader(remoteHail)
				this.masterPlayerUid = reader.readUInt32()
				this.masterToken = reader.readString(4096)
			},
			onPayload: (payload) => {
				try {
					const roomResponse = parseMasterRoomResponse(payload)
					if (roomResponse) {
						this.roomResponses.push(roomResponse)
						return
					}
					const packet = parseLobbyPacket(payload)
					if (!packet) {
						return
					}
					if (firstSnapshotTimer) {
						clearTimeout(firstSnapshotTimer)
						firstSnapshotTimer = undefined
					}
					const observedAt = new Date().toISOString()
					state.apply(packet)
					const snapshot = state.snapshot('live', null, observedAt)
					this.lastSnapshot = snapshot
					this.publish(snapshot)
					this.persistence.enqueue(packet, observedAt)
				} catch {
					invalidPacket = true
					void lidgren.close('Invalid lobby packet')
				}
			},
		})
		this.lidgren = lidgren
		try {
			await lidgren.connect()
			this.masterConnected = true
			console.info('Zeepkist lobby collector connected to master server.')
			firstSnapshotTimer = setTimeout(() => {
				firstSnapshotTimedOut = true
				void lidgren.close('Lobby snapshot timed out')
			}, FIRST_SNAPSHOT_TIMEOUT_MS)
			await lidgren.waitForClose()
		} finally {
			this.masterConnected = false
			if (firstSnapshotTimer) {
				clearTimeout(firstSnapshotTimer)
			}
			if (this.lidgren === lidgren) {
				this.lidgren = undefined
				this.masterPlayerUid = undefined
				this.masterToken = undefined
				this.roomResponses.rejectAll(new Error('Master connection closed'))
			}
		}
		if (invalidPacket) {
			throw new Error('Master server sent invalid lobby packet')
		}
		if (firstSnapshotTimedOut) {
			throw new Error('Master server did not send an initial lobby snapshot')
		}
	}

	private async assignRoomOnce(existingJoinId?: string): Promise<RoomAssignment> {
		const lidgren = this.lidgren
		const identity = this.identity
		const token = this.masterToken
		const playerUid = this.masterPlayerUid
		if (!lidgren || !identity || !token || playerUid === undefined) {
			throw new Error('Master connection is unavailable')
		}

		if (existingJoinId) {
			const joined = await this.sendRoomCommand(
				lidgren,
				'join',
				joinLobbyPacket(existingJoinId),
			)
			if (joined.result === 1) {
				return {
					host: joined.host,
					joinId: existingJoinId,
					playerUid,
					port: joined.port,
					steamId: identity.steamId.toString(),
					token,
				}
			}
		}

		const created = await this.sendRoomCommand(
			lidgren,
			'create',
			createLobbyPacket({
				isPublic: this.config.room.isPublic,
				maxPlayers: this.config.room.maxPlayers,
				name: sanitizeLobbyText(this.config.room.name, 'ZeepCentraal | Track of the Week'),
				originalHostName: sanitizeLobbyText(identity.name, 'ZeepCentraal'),
			}),
		)
		if (created.result !== 1 || !created.joinId) {
			throw new Error(`Create lobby failed with result ${created.result}`)
		}
		const joinId = created.joinId
		const joined = await this.waitForRoomResponse(lidgren, 'join')
		if (joined.result !== 1)
			throw new Error(`Join created lobby failed with result ${joined.result}`)
		return {
			host: joined.host,
			joinId,
			playerUid,
			port: joined.port,
			steamId: identity.steamId.toString(),
			token,
		}
	}

	private async sendRoomCommand<T extends MasterRoomResponse['type']>(
		lidgren: LidgrenClient,
		type: T,
		payload: Uint8Array,
	) {
		const response = this.roomResponses.waitFor(type)
		try {
			await lidgren.sendReliableOrdered(payload)
			return await response
		} catch (error) {
			this.roomResponses.rejectAll(
				error instanceof Error ? error : new Error('Room command failed'),
			)
			void response.catch(() => {})
			await lidgren.close('Room command failed')
			throw error
		}
	}

	private async waitForRoomResponse<T extends MasterRoomResponse['type']>(
		lidgren: LidgrenClient,
		type: T,
	) {
		try {
			return await this.roomResponses.waitFor(type)
		} catch (error) {
			await lidgren.close('Room command timed out')
			throw error
		}
	}

	private async stopConnections() {
		try {
			await this.lidgren?.close()
		} finally {
			this.steam?.close()
			await this.persistence.drain()
		}
	}

	private async getTicket() {
		if (this.cachedTicket && Date.now() - this.ticketCreatedAt < MIN_TICKET_INTERVAL_MS) {
			return this.cachedTicket
		}
		if (!this.steam) {
			throw new Error('Steam session is unavailable')
		}
		const waitMs = MIN_TICKET_INTERVAL_MS - (Date.now() - this.lastTicketRequestAt)
		if (waitMs > 0) {
			await delay(waitMs)
		}
		this.lastTicketRequestAt = Date.now()
		this.cachedTicket = await this.steam.createEncryptedAppTicket()
		this.ticketCreatedAt = Date.now()
		return this.cachedTicket
	}

	private markStale() {
		if (!this.lastSnapshot) {
			this.publish(emptySnapshot('connecting'))
			return
		}
		const stale = {
			...this.lastSnapshot,
			status: 'stale' as const,
			staleSince: new Date().toISOString(),
		}
		this.lastSnapshot = stale
		this.publish(stale)
	}
}

class RoomResponseInbox {
	private readonly queued: MasterRoomResponse[] = []
	private readonly waiters = new Map<
		MasterRoomResponse['type'],
		{
			reject: (error: Error) => void
			resolve: (response: MasterRoomResponse) => void
			timer: ReturnType<typeof setTimeout>
		}
	>()

	waitFor<T extends MasterRoomResponse['type']>(type: T) {
		type Response = Extract<MasterRoomResponse, { type: T }>
		const queuedIndex = this.queued.findIndex((response) => response.type === type)
		if (queuedIndex >= 0)
			return Promise.resolve(this.queued.splice(queuedIndex, 1)[0] as Response)
		return new Promise<Response>((resolve, reject) => {
			if (this.waiters.has(type))
				return reject(new Error(`Already waiting for ${type} response`))
			const timer = setTimeout(() => {
				this.waiters.delete(type)
				reject(new Error(`Timed out waiting for ${type} response`))
			}, ROOM_RESPONSE_TIMEOUT_MS)
			this.waiters.set(type, {
				resolve: resolve as (response: MasterRoomResponse) => void,
				reject,
				timer,
			})
		})
	}

	push(response: MasterRoomResponse) {
		const waiter = this.waiters.get(response.type)
		if (!waiter) {
			this.queued.push(response)
			return
		}
		clearTimeout(waiter.timer)
		this.waiters.delete(response.type)
		waiter.resolve(response)
	}

	rejectAll(error: Error) {
		this.queued.length = 0
		for (const waiter of this.waiters.values()) {
			clearTimeout(waiter.timer)
			waiter.reject(error)
		}
		this.waiters.clear()
	}
}

function createHail(build: number, identity: SteamIdentity, ticket: Uint8Array) {
	const writer = new BitWriter()
	writer.writeInt32(build)
	writer.writeUInt64(identity.steamId)
	writer.writeString(identity.name)
	writer.writeString('')
	writer.writeString(identity.name)
	writer.writeInt32(ticket.length)
	writer.writeBytes(ticket)
	writer.writeInt32(ticket.length)
	return writer.toUint8Array()
}

function emptySnapshot(status: 'connecting' | 'unavailable'): LobbySnapshot {
	return {
		status,
		updatedAt: null,
		staleSince: null,
		stats: { onlinePlayers: null, lobbyCount: null, playersInLobbies: null },
		lobbies: [],
	}
}

function withJitter(delayMs: number) {
	return Math.round(delayMs * (0.8 + Math.random() * 0.4))
}

function delay(delayMs: number) {
	return new Promise<void>((resolve) => setTimeout(resolve, delayMs))
}

function safeErrorMessage(error: unknown) {
	const message = error instanceof Error ? error.message : 'Unknown error'
	return message.replace(/[\r\n\t]/g, ' ').slice(0, 200)
}

function sanitizeLobbyText(value: string, fallback: string) {
	return (
		value
			.replace(/['"\\/]/g, '')
			.trim()
			.slice(0, 256) || fallback
	)
}
