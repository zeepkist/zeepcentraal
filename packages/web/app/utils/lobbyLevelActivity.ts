import type { Zc_LobbyLevelActivityRoomFragment } from '@zeepkist/graphql/generated'
import { LOBBY_STALE_MS } from './lobbyAnalytics'

const RANKING_LIMIT = 10

type Room = Zc_LobbyLevelActivityRoomFragment
type Ranking = { id: string; name: string; lastSeen: number; rooms: number; players: number }

function positiveId(value: unknown): string | null {
	const id = typeof value === 'string' ? value.trim() : String(value)
	return /^[1-9]\d*$/.test(id) ? id : null
}

function authorId(room: Room): string | null {
	const id = positiveId(room.levelAuthorSteamId)
	return id === '1' ? null : id
}

function observedAt(room: Room) {
	return Date.parse(String(room.lastSeen))
}

function isFreshOpen(room: Room, now: number) {
	return room.closedAt == null && observedAt(room) >= now - LOBBY_STALE_MS
}

function addRank(
	ranks: Map<string, Ranking>,
	id: string | null,
	name: string | null,
	lastSeen: number,
	players: number,
) {
	if (id === null) return
	const existing = ranks.get(id)
	if (existing) {
		existing.rooms++
		existing.players += players
		if (name && (!existing.name || lastSeen > existing.lastSeen)) {
			existing.name = name
			existing.lastSeen = lastSeen
		}
	} else {
		ranks.set(id, { id, name: name ?? '', lastSeen, rooms: 1, players })
	}
}

function topRanks(ranks: Map<string, Ranking>) {
	return [...ranks.values()]
		.sort((a, b) => b.rooms - a.rooms || b.players - a.players || a.id.localeCompare(b.id))
		.slice(0, RANKING_LIMIT)
}

export function rankLobbyLevelActivity(
	rooms: readonly Room[],
	by: 'workshop' | 'author',
	now: number,
) {
	const ranks = new Map<string, Ranking>()
	const seen = new Set<string>()
	for (const room of rooms) {
		const id = String(room.id)
		if (seen.has(id)) continue
		seen.add(id)
		const players = isFreshOpen(room, now) ? (room.players ?? 0) : 0
		const group = by === 'workshop' ? positiveId(room.levelWorkshopId) : authorId(room)
		const name = by === 'workshop' ? room.levelName : room.levelAuthor
		addRank(ranks, group, name, observedAt(room), players)
	}
	return topRanks(ranks)
}
