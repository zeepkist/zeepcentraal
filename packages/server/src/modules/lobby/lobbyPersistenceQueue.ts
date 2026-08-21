import type { LobbyPacket } from '@zeepkist/core/zeepnet'

export type PersistLobbyPacket = (packet: LobbyPacket, observedAt: string) => Promise<void>

export class LobbyPersistenceQueue {
	private tail = Promise.resolve()

	constructor(
		private readonly persist: PersistLobbyPacket,
		private readonly onError: () => void,
	) {}

	enqueue(packet: LobbyPacket, observedAt: string) {
		this.tail = this.tail
			.then(() => this.persist(packet, observedAt))
			.catch(() => this.onError())
	}

	drain() {
		return this.tail
	}
}
