import type { LobbySnapshot } from '@zeepkist/core'
import { BitWriter, LidgrenClient, parseLobbyPacket } from '@zeepkist/core/zeepnet'
import { LobbyState } from './lobbyState'
import { LobbySteamSession, type SteamIdentity } from './steamSession'

interface LobbyCollectorConfig {
	appId: number
	build: number
	host: string
	port: number
	refreshTokenFile: string
}

const MIN_TICKET_INTERVAL_MS = 60_000
const FIRST_SNAPSHOT_TIMEOUT_MS = 15_000

export class LobbyCollector {
	private stopped = false
	private lidgren: LidgrenClient | undefined
	private steam: LobbySteamSession | undefined
	private lastSnapshot: LobbySnapshot | undefined
	private cachedTicket: Buffer | undefined
	private ticketCreatedAt = 0
	private lastTicketRequestAt = 0
	private stopPromise: Promise<void> | undefined

	constructor(
		private readonly config: LobbyCollectorConfig,
		private readonly publish: (snapshot: LobbySnapshot) => void,
	) {}

	start() {
		this.publish(emptySnapshot('connecting'))
		void this.run()
	}

	stop() {
		this.stopped = true
		this.stopPromise ??= this.stopConnections()
		return this.stopPromise
	}

	private async run() {
		let retry = 1_000
		try {
			this.steam = new LobbySteamSession(this.config.refreshTokenFile, this.config.appId)
			const identity = await this.steam.connect()
			while (!this.stopped) {
				try {
					await this.connectToMaster(identity)
					retry = 1_000
				} catch (error) {
					if (!this.stopped) {
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
			onPayload: (payload) => {
				try {
					const packet = parseLobbyPacket(payload)
					if (!packet) {
						return
					}
					if (firstSnapshotTimer) {
						clearTimeout(firstSnapshotTimer)
						firstSnapshotTimer = undefined
					}
					state.apply(packet)
					const snapshot = state.snapshot('live')
					this.lastSnapshot = snapshot
					this.publish(snapshot)
				} catch {
					invalidPacket = true
					void lidgren.close('Invalid lobby packet')
				}
			},
		})
		this.lidgren = lidgren
		try {
			await lidgren.connect()
			firstSnapshotTimer = setTimeout(() => {
				firstSnapshotTimedOut = true
				void lidgren.close('Lobby snapshot timed out')
			}, FIRST_SNAPSHOT_TIMEOUT_MS)
			await lidgren.waitForClose()
		} finally {
			if (firstSnapshotTimer) {
				clearTimeout(firstSnapshotTimer)
			}
			if (this.lidgren === lidgren) {
				this.lidgren = undefined
			}
		}
		if (invalidPacket) {
			throw new Error('Master server sent invalid lobby packet')
		}
		if (firstSnapshotTimedOut) {
			throw new Error('Master server did not send an initial lobby snapshot')
		}
	}

	private async stopConnections() {
		try {
			await this.lidgren?.close()
		} finally {
			this.steam?.close()
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
