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

export class LobbyCollector {
	private stopped = false
	private lidgren: LidgrenClient | undefined
	private steam: LobbySteamSession | undefined
	private lastSnapshot: LobbySnapshot | undefined
	private cachedTicket: Buffer | undefined
	private ticketCreatedAt = 0
	private lastTicketRequestAt = 0

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
		this.lidgren?.close()
		this.steam?.close()
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
				} catch {
					console.warn('Zeepkist lobby collector connection failed; retrying')
				}
				if (this.stopped) {
					break
				}
				this.markStale()
				await delay(withJitter(retry))
				retry = Math.min(retry * 2, 60_000)
			}
		} catch {
			console.error('Zeepkist lobby collector could not start Steam session')
			this.publish(emptySnapshot('unavailable'))
		}
	}

	private async connectToMaster(identity: SteamIdentity) {
		const ticket = await this.getTicket()
		const state = new LobbyState()
		let invalidPacket = false
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
					state.apply(packet)
					const snapshot = state.snapshot('live')
					this.lastSnapshot = snapshot
					this.publish(snapshot)
				} catch {
					invalidPacket = true
					lidgren.close()
				}
			},
		})
		this.lidgren = lidgren
		await lidgren.connect()
		await lidgren.waitForClose()
		this.lidgren = undefined
		if (invalidPacket) {
			throw new Error('Master server sent invalid lobby packet')
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
