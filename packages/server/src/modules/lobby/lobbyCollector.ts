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
	credentialRefreshMs: number
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
const MAX_RETRY_MS = 60_000
const CREDENTIAL_DEADLINE_MS = 60 * 60_000
const CREDENTIAL_REFRESH_TIMEOUT_MS = 30_000
const CREDENTIAL_REFRESH_FAILURE_COOLDOWN_MS = 5_000
const MIN_CREDENTIAL_HANDOFF_LEASE_MS = 30_000
const meter = getMeter('zeepcentraal-lobby-collector')
const assignmentLatency = meter.createHistogram('zeepkist.lobby.assignment.duration', {
	description: 'Master room assignment latency',
	unit: 'ms',
})
const reconnects = meter.createCounter('zeepkist.lobby.master.reconnects', {
	description: 'Failed master connections followed by retry',
})

export interface RoomCredential {
	credentialDeadlineAt: number
	credentialGeneration: number
	credentialIssuedAt: number
	credentialRefreshAt: number
	playerUid: number
	steamId: string
	token: string
}

export interface RoomAssignment extends RoomCredential {
	host: string
	joinId: string
	port: number
}

export type RoomCredentialRefresh =
	| { status: 'pending' }
	| { status: 'ready'; credential: RoomCredential }
	| { status: 'unavailable' }

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
	private masterCredential: RoomCredential | undefined
	private credentialGeneration = 0
	private credentialRefreshPromise: Promise<void> | undefined
	private credentialRefreshFailedAt = 0
	private roomAssignmentPromise: Promise<RoomAssignment> | undefined
	private masterConnected = false
	private readonly roomResponses = new RoomResponseInbox()
	private readonly credentialWaiters = new Set<CredentialWaiter>()
	private readonly persistence: LobbyPersistenceQueue

	constructor(
		private readonly config: LobbyCollectorConfig,
		private readonly publish: (snapshot: LobbySnapshot) => void,
		persist: PersistLobbyPacket,
		private readonly createSteamSession: (
			refreshTokenFile: string,
			appId: number,
		) => LobbySteamSession = (refreshTokenFile, appId) =>
			new LobbySteamSession(refreshTokenFile, appId),
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
			this.roomAssignmentPromise = (this.credentialRefreshPromise ?? Promise.resolve())
				.then(() => this.assignRoomOnce(existingJoinId))
				.catch((error) => {
					const reason =
						error instanceof RoomAssignmentError
							? error.reason
							: this.masterConnected
								? 'command-failed'
								: 'master-unavailable'
					console.warn(`Zeepkist room assignment unavailable: ${reason}`)
					throw error
				})
				.finally(() => {
					assignmentLatency.record(performance.now() - startedAt)
					this.roomAssignmentPromise = undefined
				})
		}
		return this.roomAssignmentPromise
	}

	refreshRoomCredential(currentGeneration: number): RoomCredentialRefresh {
		const credential = this.masterCredential
		if (credential && this.isUsableNewCredential(credential, currentGeneration)) {
			return { status: 'ready', credential }
		}
		if (this.stopped || !this.identity) return { status: 'unavailable' }
		if (
			this.credentialRefreshFailedAt > 0 &&
			Date.now() - this.credentialRefreshFailedAt < CREDENTIAL_REFRESH_FAILURE_COOLDOWN_MS
		) {
			return { status: 'unavailable' }
		}
		this.startCredentialRefresh(currentGeneration)
		return { status: 'pending' }
	}

	private async run() {
		let retryMs = 1_000
		while (!this.stopped) {
			const steam = this.createSteamSession(this.config.refreshTokenFile, this.config.appId)
			this.steam = steam
			try {
				const identity = await steam.connect()
				this.identity = identity
				await this.runMasterConnections(identity, () => {
					retryMs = 1_000
				})
			} catch {
				if (!this.stopped) {
					console.error('Zeepkist lobby Steam session unavailable; recreating session')
					if (this.lastSnapshot) this.markStale()
					else this.publish(emptySnapshot('unavailable'))
				}
			} finally {
				await steam.close()
				if (this.steam === steam) this.steam = undefined
				this.identity = undefined
				this.cachedTicket = undefined
				this.ticketCreatedAt = 0
			}
			if (!this.stopped) {
				await delay(withJitter(retryMs))
				retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
			}
		}
	}

	private async runMasterConnections(identity: SteamIdentity, onSteamAuthenticated: () => void) {
		let retryMs = 1_000
		while (!this.stopped) {
			try {
				await this.connectToMaster(identity, onSteamAuthenticated)
				retryMs = 1_000
			} catch (error) {
				if (error instanceof SteamSessionUnavailableError) throw error
				if (!this.stopped) {
					reconnects.add(1)
					console.warn(
						`Zeepkist lobby collector connection failed; retrying: ${safeErrorMessage(error)}`,
					)
				}
			}
			if (this.stopped) break
			this.markStale()
			await delay(withJitter(retryMs))
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
		}
	}

	private async connectToMaster(identity: SteamIdentity, onSteamAuthenticated: () => void) {
		const ticket = await this.getTicket()
		onSteamAuthenticated()
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
				const playerUid = reader.readUInt32()
				const token = reader.readString(4096)
				this.publishMasterCredential(identity, playerUid, token)
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
		const credential = this.masterCredential
		if (!lidgren || !this.identity || !credential || !this.masterConnected) {
			throw new RoomAssignmentError('master-unavailable')
		}

		if (existingJoinId) {
			const joined = await this.sendRoomCommand(
				lidgren,
				'join',
				joinLobbyPacket(existingJoinId),
			)
			if (joined.result === 1) {
				const assignment = {
					...credential,
					host: joined.host,
					joinId: existingJoinId,
					port: joined.port,
				}
				await lidgren.close('Room assignment handed off')
				return assignment
			}
			if (joined.result !== 4) throw new RoomAssignmentError('join-rejected')
		}

		const created = await this.sendRoomCommand(
			lidgren,
			'create',
			createLobbyPacket({
				isPublic: this.config.room.isPublic,
				maxPlayers: this.config.room.maxPlayers,
				name: sanitizeLobbyText(this.config.room.name, 'ZeepCentraal | Track of the Week'),
				originalHostName: sanitizeLobbyText(this.identity.name, 'ZeepCentraal'),
			}),
		)
		if (created.result !== 1 || !created.joinId) {
			if (created.result === 2) {
				await lidgren.close('Master connection remained assigned to previous room')
				throw new RoomAssignmentError('already-in-lobby')
			}
			throw new RoomAssignmentError('create-rejected')
		}
		const joinId = created.joinId
		const joined = await this.waitForRoomResponse(lidgren, 'join')
		if (joined.result !== 1) throw new RoomAssignmentError('join-rejected')
		const assignment = {
			...credential,
			host: joined.host,
			joinId,
			port: joined.port,
		}
		await lidgren.close('Room assignment handed off')
		return assignment
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
			const failure =
				error instanceof RoomAssignmentError
					? error
					: new RoomAssignmentError('command-failed', error)
			this.roomResponses.rejectAll(failure)
			void response.catch(() => {})
			await lidgren.close('Room command failed')
			throw failure
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
			throw new RoomAssignmentError('response-timeout', error)
		}
	}

	private async stopConnections() {
		try {
			await this.lidgren?.close()
		} finally {
			await this.steam?.close()
			this.rejectCredentialWaiters(new Error('Lobby collector stopped'))
			await this.persistence.drain()
		}
	}

	private startCredentialRefresh(currentGeneration: number) {
		if (this.credentialRefreshPromise) return
		const assignment = this.roomAssignmentPromise
		const refresh = (async () => {
			if (assignment) await assignment.catch(() => undefined)
			if (this.isUsableNewCredential(this.masterCredential, currentGeneration)) return
			const refreshAfterGeneration = Math.max(
				currentGeneration,
				this.masterCredential?.credentialGeneration ?? 0,
			)
			this.cachedTicket = undefined
			this.ticketCreatedAt = 0
			const freshCredential = this.waitForCredentialAfter(refreshAfterGeneration)
			await this.lidgren?.close('Refreshing room credential')
			await freshCredential
			this.credentialRefreshFailedAt = 0
		})()
			.catch(() => {
				this.credentialRefreshFailedAt = Date.now()
				console.warn(
					'Zeepkist room credential refresh failed; existing room connection retained',
				)
			})
			.finally(() => {
				if (this.credentialRefreshPromise === refresh)
					this.credentialRefreshPromise = undefined
			})
		this.credentialRefreshPromise = refresh
	}

	private isUsableNewCredential(
		credential: RoomCredential | undefined,
		currentGeneration: number,
	) {
		return (
			this.masterConnected &&
			credential !== undefined &&
			credential.credentialGeneration > currentGeneration &&
			credential.credentialRefreshAt - Date.now() >= MIN_CREDENTIAL_HANDOFF_LEASE_MS
		)
	}

	private publishMasterCredential(identity: SteamIdentity, playerUid: number, token: string) {
		const credentialIssuedAt = Date.now()
		const credential: RoomCredential = {
			credentialDeadlineAt: credentialIssuedAt + CREDENTIAL_DEADLINE_MS,
			credentialGeneration: ++this.credentialGeneration,
			credentialIssuedAt,
			credentialRefreshAt: credentialIssuedAt + this.config.credentialRefreshMs,
			playerUid,
			steamId: identity.steamId.toString(),
			token,
		}
		this.masterCredential = credential
		for (const waiter of this.credentialWaiters) {
			if (credential.credentialGeneration <= waiter.afterGeneration) continue
			clearTimeout(waiter.timer)
			this.credentialWaiters.delete(waiter)
			waiter.resolve(credential)
		}
	}

	private waitForCredentialAfter(afterGeneration: number) {
		const current = this.masterCredential
		if (current && current.credentialGeneration > afterGeneration)
			return Promise.resolve(current)
		return new Promise<RoomCredential>((resolve, reject) => {
			const waiter: CredentialWaiter = {
				afterGeneration,
				reject,
				resolve,
				timer: setTimeout(() => {
					this.credentialWaiters.delete(waiter)
					reject(new Error('Timed out waiting for refreshed room credential'))
				}, CREDENTIAL_REFRESH_TIMEOUT_MS),
			}
			this.credentialWaiters.add(waiter)
		})
	}

	private rejectCredentialWaiters(error: Error) {
		for (const waiter of this.credentialWaiters) {
			clearTimeout(waiter.timer)
			waiter.reject(error)
		}
		this.credentialWaiters.clear()
	}

	private async getTicket() {
		if (this.cachedTicket && Date.now() - this.ticketCreatedAt < MIN_TICKET_INTERVAL_MS) {
			return this.cachedTicket
		}
		if (!this.steam) {
			throw new SteamSessionUnavailableError()
		}
		const waitMs = MIN_TICKET_INTERVAL_MS - (Date.now() - this.lastTicketRequestAt)
		if (waitMs > 0) {
			await delay(waitMs)
		}
		this.lastTicketRequestAt = Date.now()
		try {
			this.cachedTicket = await this.steam.createEncryptedAppTicket()
		} catch (error) {
			throw new SteamSessionUnavailableError(error)
		}
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

interface CredentialWaiter {
	afterGeneration: number
	reject: (error: Error) => void
	resolve: (credential: RoomCredential) => void
	timer: ReturnType<typeof setTimeout>
}

type RoomAssignmentFailure =
	| 'already-in-lobby'
	| 'command-failed'
	| 'create-rejected'
	| 'join-rejected'
	| 'master-unavailable'
	| 'response-timeout'

class RoomAssignmentError extends Error {
	constructor(
		readonly reason: RoomAssignmentFailure,
		cause?: unknown,
	) {
		super('Room assignment unavailable', { cause })
	}
}

class SteamSessionUnavailableError extends Error {
	constructor(cause?: unknown) {
		super('Steam session is unavailable', { cause })
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
