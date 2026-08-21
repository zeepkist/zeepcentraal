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
})

function assignment() {
	return {
		host: '127.0.0.1',
		joinId: 'managed-room',
		playerUid: 7,
		port: 12345,
		steamId: '76561198000000000',
		token: 'ephemeral-game-token',
	}
}
