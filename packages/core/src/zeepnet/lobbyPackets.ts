import type { LobbyListing } from '../lobby'
import { BitReader } from './binary'

export const LOBBY_PACKET_ID = {
	list: 5326,
	update: 62071,
	statistics: 37660,
} as const

const MAX_LOBBIES = 4096

export interface WireLobby extends LobbyListing {
	id: string
}

export type LobbyPacket =
	| { type: 'list'; lobbies: WireLobby[] }
	| { type: 'update'; operation: 'added' | 'removed' | 'updated'; lobby: WireLobby }
	| {
			type: 'statistics'
			onlinePlayers: number
			lobbyCount: number
			playersInLobbies: number
	  }

export function parseLobbyPacket(data: Uint8Array): LobbyPacket | null {
	const reader = new BitReader(data)
	const packetId = reader.readUInt16()

	switch (packetId) {
		case LOBBY_PACKET_ID.list: {
			const count = readBoundedCount(reader)
			const lobbies: WireLobby[] = []
			for (let index = 0; index < count; index++) {
				lobbies.push(readLobby(reader))
			}
			return { type: 'list', lobbies }
		}
		case LOBBY_PACKET_ID.update: {
			const operation = (['added', 'removed', 'updated'] as const)[reader.readByte()]
			if (!operation) {
				throw new Error('Unknown lobby update operation')
			}
			return { type: 'update', operation, lobby: readLobby(reader) }
		}
		case LOBBY_PACKET_ID.statistics:
			return {
				type: 'statistics',
				onlinePlayers: readNonNegative(reader, 'online player count'),
				lobbyCount: readNonNegative(reader, 'lobby count'),
				playersInLobbies: readNonNegative(reader, 'players in lobbies'),
			}
		default:
			return null
	}
}

function readBoundedCount(reader: BitReader) {
	const count = readNonNegative(reader, 'lobby count')
	if (count > MAX_LOBBIES) {
		throw new Error(`Lobby count exceeds ${MAX_LOBBIES}`)
	}
	return count
}

function readNonNegative(reader: BitReader, name: string) {
	const value = reader.readInt32()
	if (value < 0) {
		throw new Error(`Invalid ${name}`)
	}
	return value
}

function readLobby(reader: BitReader): WireLobby {
	const id = reader.readString(1024)
	const title = reader.readString(4096)
	const hostName = reader.readString(1024)
	const steamId = reader.readUInt64().toString()
	const players = readNonNegative(reader, 'lobby player count')
	const playerLimit = readNonNegative(reader, 'lobby player limit')
	const isPublic = reader.readBoolean()

	return {
		id,
		title,
		isPublic,
		host: { name: hostName, steamId },
		players,
		playerLimit,
	}
}
