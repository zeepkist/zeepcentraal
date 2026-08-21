import type { LobbySnapshot } from '@zeepkist/core'
import type { LobbyPacket, WireLobby } from '@zeepkist/core/zeepnet'

export class LobbyState {
	private readonly lobbies = new Map<string, WireLobby>()
	private stats: LobbySnapshot['stats'] = {
		onlinePlayers: null,
		lobbyCount: null,
		playersInLobbies: null,
	}

	apply(packet: LobbyPacket) {
		if (packet.type === 'list') {
			this.lobbies.clear()
			for (const lobby of packet.lobbies) {
				this.lobbies.set(lobby.id, lobby)
			}
		} else if (packet.type === 'update') {
			if (packet.operation === 'removed') {
				this.lobbies.delete(packet.lobby.id)
			} else {
				this.lobbies.set(packet.lobby.id, packet.lobby)
			}
		} else {
			this.stats = {
				onlinePlayers: packet.onlinePlayers,
				lobbyCount: packet.lobbyCount,
				playersInLobbies: packet.playersInLobbies,
			}
		}
	}

	snapshot(
		status: LobbySnapshot['status'],
		staleSince: string | null = null,
		updatedAt: string = new Date().toISOString(),
	): LobbySnapshot {
		return {
			status,
			updatedAt: status === 'live' ? updatedAt : null,
			staleSince,
			stats: { ...this.stats },
			lobbies: [...this.lobbies.values()]
				.filter((lobby) => lobby.players > 0)
				.sort(
					(left, right) =>
						right.players - left.players ||
						left.title.localeCompare(right.title) ||
						left.host.name.localeCompare(right.host.name),
				)
				.map(({ id: _id, ...lobby }) => lobby),
		}
	}
}
