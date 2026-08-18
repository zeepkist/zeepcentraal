import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { isLobbySnapshot } from '../../app/composables/useLobbyFeed'

const page = readFileSync(new URL('../../app/pages/lobby.vue', import.meta.url), 'utf8')
const table = readFileSync(
	new URL('../../app/components/lobby/LobbyTable.vue', import.meta.url),
	'utf8',
)
const feed = readFileSync(new URL('../../app/composables/useLobbyFeed.ts', import.meta.url), 'utf8')

describe('lobby feed', () => {
	test('accepts complete public and private snapshots', () => {
		expect(
			isLobbySnapshot({
				status: 'live',
				updatedAt: '2026-08-18T12:00:00.000Z',
				staleSince: null,
				stats: { onlinePlayers: 10, lobbyCount: 2, playersInLobbies: 8 },
				lobbies: [
					{
						title: 'Room',
						isPublic: false,
						host: { name: 'Host', steamId: '76561198000000000' },
						players: 8,
						playerLimit: 64,
					},
				],
			}),
		).toBe(true)
	})

	test('rejects lobby snapshots missing privacy', () => {
		expect(
			isLobbySnapshot({
				status: 'live',
				stats: {},
				lobbies: [
					{
						title: 'Room',
						host: { name: 'Host', steamId: '1' },
						players: 1,
						playerLimit: 64,
					},
				],
			}),
		).toBe(false)
	})

	test('renders privacy, host profile links, counts, and resilient SSE', () => {
		expect(table).toContain('v-if="!lobby.isPublic"')
		expect(table).toContain('name="lock"')
		expect(table).toContain('`/user/' + '$' + '{lobby.host.steamId}`')
		expect(table).toContain('number.format(lobby.players)')
		expect(table).toContain('number.format(lobby.playerLimit)')
		expect(feed).toContain('new EventSource(`' + '$' + '{baseUrl}/lobby/events`)')
		expect(feed).toContain("events.addEventListener('snapshot'")
		expect(feed).toContain('onScopeDispose(() => events?.close())')
		expect(page).toContain("usePageSeo('lobby')")
	})
})
