import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { startRoomBroker } from './roomBroker'

const token = 't'.repeat(32)
const servers: Array<{ stop: () => unknown }> = []
const blockedFetch = globalThis.fetch

beforeEach(() => {
	globalThis.fetch = Bun.fetch
})

afterEach(async () => {
	await Promise.all(servers.splice(0).map((server) => server.stop()))
	globalThis.fetch = blockedFetch
})

describe('TotW room broker', () => {
	test('rejects missing authentication without assigning room', async () => {
		const assignRoom = mock(async () => assignment())
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/totw/assignment`, {
			method: 'POST',
			body: '{}',
		})
		expect(response.status).toBe(401)
		expect(assignRoom).not.toHaveBeenCalled()
	})

	test('passes optional managed join ID and returns ephemeral assignment', async () => {
		const assignRoom = mock(async () => assignment())
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/totw/assignment`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ joinId: 'managed-room' }),
		})
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(assignRoom).toHaveBeenCalledWith('managed-room')
		expect(await response.json()).toEqual(assignment())
	})

	test('returns sanitized error when assignment fails', async () => {
		const assignRoom = mock(async () => {
			throw new Error('secret-game-token')
		})
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/totw/assignment`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: '{}',
		})
		expect(response.status).toBe(503)
		expect(await response.text()).toBe('{"error":"Room assignment unavailable"}')
	})

	test('returns pending then refreshed credential without assigning room', async () => {
		const assignRoom = mock(async () => assignment())
		const refreshRoomCredential = mock((generation: number) =>
			refreshRoomCredential.mock.calls.length === 1
				? { status: 'pending' as const }
				: { status: 'ready' as const, credential: credential(generation + 1) },
		)
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
			refreshRoomCredential,
		} as never)
		servers.push(server)
		const request = () =>
			fetch(`http://127.0.0.1:${server.port}/v1/totw/credential`, {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ credentialGeneration: 2 }),
			})

		const pending = await request()
		expect(pending.status).toBe(202)
		expect(pending.headers.get('retry-after')).toBe('1')
		const ready = await request()
		expect(ready.status).toBe(200)
		expect(await ready.json()).toEqual(credential(3))
		expect(refreshRoomCredential).toHaveBeenCalledTimes(2)
		expect(assignRoom).not.toHaveBeenCalled()
	})

	test('rejects invalid credential generation', async () => {
		const refreshRoomCredential = mock(() => ({ status: 'pending' as const }))
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom: mock(async () => assignment()),
			refreshRoomCredential,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/totw/credential`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ credentialGeneration: -1 }),
		})
		expect(response.status).toBe(400)
		expect(refreshRoomCredential).not.toHaveBeenCalled()
	})
})

function assignment() {
	return {
		...credential(2),
		host: '127.0.0.1',
		joinId: 'managed-room',
		port: 12345,
	}
}

function credential(generation: number) {
	return {
		credentialDeadlineAt: 3_700_000,
		credentialGeneration: generation,
		credentialIssuedAt: 100_000,
		credentialRefreshAt: 3_100_000,
		playerUid: 7,
		steamId: '76561198000000000',
		token: `ephemeral-game-token-${generation}`,
	}
}
