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

describe('managed room broker', () => {
	test('rejects missing authentication without assigning room', async () => {
		const assignRoom = mock(async () => assignment())
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/rooms/assignment`, {
			method: 'POST',
			body: JSON.stringify(request()),
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
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/rooms/assignment`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(request('managed-room')),
		})
		expect(response.status).toBe(200)
		expect(response.headers.get('cache-control')).toBe('no-store')
		expect(assignRoom).toHaveBeenCalledWith(request('managed-room'))
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
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/rooms/assignment`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(request()),
		})
		expect(response.status).toBe(503)
		expect(await response.text()).toBe('{"error":"Room assignment unavailable"}')
	})

	test('does not expose removed TotW or credential endpoints', async () => {
		const assignRoom = mock(async () => assignment())
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/totw/credential`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ credentialGeneration: 2 }),
		})
		expect(response.status).toBe(404)
		const oldAssignment = await fetch(`http://127.0.0.1:${server.port}/v1/totw/assignment`, {
			method: 'POST',
		})
		expect(oldAssignment.status).toBe(404)
		expect(assignRoom).not.toHaveBeenCalled()
	})

	test('rejects malformed room configuration', async () => {
		const assignRoom = mock(async () => assignment())
		const server = startRoomBroker({ host: '127.0.0.1', port: 0, token }, {
			assignRoom,
		} as never)
		servers.push(server)
		const response = await fetch(`http://127.0.0.1:${server.port}/v1/rooms/assignment`, {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ ...request(), key: 'INVALID KEY' }),
		})
		expect(response.status).toBe(400)
		expect(assignRoom).not.toHaveBeenCalled()
	})
})

function request(joinId?: string) {
	return {
		key: 'totw',
		joinId,
		room: { name: 'Track of the Week', isPublic: true, maxPlayers: 64 },
	}
}

function assignment() {
	return {
		host: '127.0.0.1',
		joinId: 'managed-room',
		key: 'totw',
		playerUid: 7,
		port: 12345,
		roomCreated: false,
		steamId: '76561198000000000',
		token: 'ephemeral-game-token',
	}
}
