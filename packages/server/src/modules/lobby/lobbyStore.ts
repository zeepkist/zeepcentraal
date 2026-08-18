import type { LobbySnapshot } from '@zeepkist/core'

export type LobbySnapshotListener = (snapshot: LobbySnapshot) => void

export const unavailableLobbySnapshot: LobbySnapshot = {
	status: 'unavailable',
	updatedAt: null,
	staleSince: null,
	stats: { onlinePlayers: null, lobbyCount: null, playersInLobbies: null },
	lobbies: [],
}

export class LobbySnapshotStore {
	private snapshot: LobbySnapshot = unavailableLobbySnapshot
	private readonly listeners = new Set<LobbySnapshotListener>()

	get() {
		return this.snapshot
	}

	set(snapshot: LobbySnapshot) {
		this.snapshot = snapshot
		for (const listener of this.listeners) {
			listener(snapshot)
		}
	}

	subscribe(listener: LobbySnapshotListener) {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}
}

export const lobbySnapshotStore = new LobbySnapshotStore()
