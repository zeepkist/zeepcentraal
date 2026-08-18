import { expect, test } from 'bun:test'
import { lobbyRoutes } from './lobbyRoutes'
import { lobbySnapshotStore } from './lobbyStore'

test('returns current lobby snapshot', async () => {
	lobbySnapshotStore.set({
		status: 'live',
		updatedAt: '2026-08-18T12:00:00.000Z',
		staleSince: null,
		stats: { onlinePlayers: 12, lobbyCount: 2, playersInLobbies: 9 },
		lobbies: [
			{
				title: 'Testing',
				isPublic: false,
				host: { name: 'Host', steamId: '76561198000000000' },
				players: 8,
				playerLimit: 64,
			},
		],
	})

	const response = await lobbyRoutes.handle(new Request('http://localhost/lobby'))
	expect(response.status).toBe(200)
	expect(response.headers.get('cache-control')).toBe('no-store')
	expect(await response.json()).toMatchObject({
		status: 'live',
		lobbies: [{ isPublic: false, players: 8, playerLimit: 64 }],
	})
})

test('opens event stream with current snapshot', async () => {
	const controller = new AbortController()
	const response = await lobbyRoutes.handle(
		new Request('http://localhost/lobby/events', { signal: controller.signal }),
	)
	expect(response.headers.get('content-type')).toBe('text/event-stream; charset=utf-8')
	const reader = response.body?.getReader()
	const first = await reader?.read()
	expect(new TextDecoder().decode(first?.value)).toContain('event: snapshot')
	controller.abort()
	await reader?.cancel()
})
