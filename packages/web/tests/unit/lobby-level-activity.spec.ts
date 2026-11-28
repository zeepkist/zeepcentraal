import type { Zc_LobbyLevelActivityRoomFragment } from '@zeepkist/graphql/generated'
import { describe, expect, it } from 'vitest'
import { rankLobbyLevelActivity } from '../../app/utils/lobbyLevelActivity'

const now = Date.parse('2026-11-27T12:00:00Z')
const hour = 3_600_000
function room(id: string, overrides: Partial<Zc_LobbyLevelActivityRoomFragment> = {}) {
	return {
		id,
		lastSeen: new Date(now).toISOString(),
		closedAt: null,
		players: 3,
		levelName: 'Track',
		levelAuthor: 'Author',
		levelWorkshopId: '123',
		levelAuthorSteamId: '76561198000000001',
		...overrides,
	}
}

describe('lobby level activity', () => {
	it('counts distinct rooms, with players only in fresh open rooms', () => {
		const rooms = [
			room('a'),
			room('a'),
			room('b', { closedAt: new Date(now).toISOString(), players: 9 }),
			room('c', { lastSeen: new Date(now - hour - 1).toISOString(), players: 8 }),
			room('d', { lastSeen: new Date(now - hour).toISOString(), players: 2 }),
			room('e', { levelWorkshopId: '0', levelAuthorSteamId: '1' }),
		]
		expect(rankLobbyLevelActivity(rooms, 'workshop', now)).toMatchObject([
			{ id: '123', rooms: 4, players: 5 },
		])
		expect(rankLobbyLevelActivity(rooms, 'author', now)).toMatchObject([
			{ id: '76561198000000001', rooms: 4, players: 5 },
		])
	})

	it('preserves Steam ID precision and ignores missing and sentinel IDs', () => {
		const rooms = [
			room('a', { levelAuthorSteamId: ' 76561198000000001 ' }),
			room('b', { levelAuthorSteamId: 76561198000000002n }),
			room('c', { levelAuthorSteamId: null }),
			room('d', { levelAuthorSteamId: '1' }),
		]
		expect(rankLobbyLevelActivity(rooms, 'author', now).map((row) => row.id)).toEqual([
			'76561198000000001',
			'76561198000000002',
		])
	})

	it('caps rankings at ten items', () => {
		const rooms = Array.from({ length: 11 }, (_, index) =>
			room(String(index), { levelWorkshopId: String(100 + index) }),
		)
		expect(rankLobbyLevelActivity(rooms, 'workshop', now)).toHaveLength(10)
	})
})
