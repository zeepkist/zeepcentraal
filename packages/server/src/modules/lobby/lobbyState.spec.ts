import { expect, test } from 'bun:test'
import { LobbyState } from './lobbyState'

test('reduces updates, hides empty rooms, and keeps raw master statistics', () => {
	const state = new LobbyState()
	state.apply({
		type: 'list',
		lobbies: [
			{
				id: 'empty',
				title: 'Empty',
				isPublic: true,
				host: { name: 'Nobody', steamId: '1' },
				players: 0,
				playerLimit: 64,
			},
		],
	})
	state.apply({
		type: 'update',
		operation: 'added',
		lobby: {
			id: 'busy',
			title: 'Busy',
			isPublic: false,
			host: { name: 'Host', steamId: '2' },
			players: 8,
			playerLimit: 64,
		},
	})
	state.apply({
		type: 'statistics',
		onlinePlayers: 10,
		lobbyCount: 2,
		playersInLobbies: 8,
	})

	const snapshot = state.snapshot('live')
	expect(snapshot.stats).toEqual({ onlinePlayers: 10, lobbyCount: 2, playersInLobbies: 8 })
	expect(snapshot.lobbies).toHaveLength(1)
	expect(snapshot.lobbies[0]?.isPublic).toBe(false)
})
