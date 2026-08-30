import type { LobbyCollector, RoomAssignmentRequest } from './lobbyCollector'

interface RoomBrokerConfig {
	host: string
	port: number
	token: string
}

export function startRoomBroker(config: RoomBrokerConfig, collector: LobbyCollector) {
	const server = Bun.serve({
		hostname: config.host,
		port: config.port,
		idleTimeout: 120,
		async fetch(request) {
			const url = new URL(request.url)
			if (request.method !== 'POST' || url.pathname !== '/v1/rooms/assignment') {
				return response({ error: 'Not found' }, 404)
			}
			if (request.headers.get('authorization') !== `Bearer ${config.token}`) {
				return response({ error: 'Unauthorized' }, 401)
			}
			let body: unknown
			try {
				body = await request.json()
			} catch {
				return response({ error: 'Invalid request' }, 400)
			}
			const assignmentRequest = readAssignmentRequest(body)
			if (!assignmentRequest) return response({ error: 'Invalid request' }, 400)
			try {
				return response(await collector.assignRoom(assignmentRequest), 200)
			} catch {
				return response({ error: 'Room assignment unavailable' }, 503)
			}
		},
	})
	console.info(`Zeepkist room broker listening on ${config.host}:${server.port}`)
	return { port: server.port, stop: () => server.stop(true) }
}

function readAssignmentRequest(body: unknown): RoomAssignmentRequest | undefined {
	if (typeof body !== 'object' || body === null) return undefined
	const value = body as Record<string, unknown>
	const room = value.room
	if (typeof room !== 'object' || room === null) return undefined
	const roomValue = room as Record<string, unknown>
	if (
		typeof value.key !== 'string' ||
		!VALUE_KEY_PATTERN.test(value.key) ||
		(value.joinId !== undefined &&
			(typeof value.joinId !== 'string' || !isBoundedText(value.joinId, 1, 1024))) ||
		typeof roomValue.name !== 'string' ||
		!isBoundedText(roomValue.name.trim(), 1, 256) ||
		typeof roomValue.isPublic !== 'boolean' ||
		typeof roomValue.maxPlayers !== 'number' ||
		!Number.isInteger(roomValue.maxPlayers) ||
		roomValue.maxPlayers < 2 ||
		roomValue.maxPlayers > 64
	) {
		return undefined
	}
	return {
		key: value.key,
		joinId: value.joinId as string | undefined,
		room: {
			name: roomValue.name.trim(),
			isPublic: roomValue.isPublic,
			maxPlayers: roomValue.maxPlayers,
		},
	}
}

const VALUE_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,62}[a-z0-9])?$/

function isBoundedText(value: string, minimumBytes: number, maximumBytes: number) {
	const bytes = new TextEncoder().encode(value).byteLength
	return bytes >= minimumBytes && bytes <= maximumBytes
}

function response(body: object, status: number) {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store' },
	})
}
