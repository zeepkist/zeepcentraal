import type { LobbyCollector } from './lobbyCollector'

interface RoomBrokerConfig {
	host: string
	port: number
	token: string
}

export function startRoomBroker(config: RoomBrokerConfig, collector: LobbyCollector) {
	const server = Bun.serve({
		hostname: config.host,
		port: config.port,
		idleTimeout: 20,
		async fetch(request) {
			const url = new URL(request.url)
			if (
				request.method !== 'POST' ||
				(url.pathname !== '/v1/totw/assignment' && url.pathname !== '/v1/totw/credential')
			) {
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
			if (url.pathname === '/v1/totw/credential') {
				const generation = readCredentialGeneration(body)
				if (generation === null) return response({ error: 'Invalid request' }, 400)
				const refresh = collector.refreshRoomCredential(generation)
				if (refresh.status === 'ready') return response(refresh.credential, 200)
				if (refresh.status === 'pending') {
					return response({ status: 'pending' }, 202, { 'Retry-After': '1' })
				}
				return response({ error: 'Room credential unavailable' }, 503)
			} else {
				const joinId = readJoinId(body)
				if (joinId === null) return response({ error: 'Invalid request' }, 400)
				try {
					return response(await collector.assignRoom(joinId), 200)
				} catch {
					return response({ error: 'Room assignment unavailable' }, 503)
				}
			}
		},
	})
	console.info(`Zeepkist room broker listening on ${config.host}:${server.port}`)
	return { port: server.port, stop: () => server.stop(true) }
}

function readJoinId(body: unknown) {
	if (typeof body !== 'object' || body === null) return null
	const joinId = (body as { joinId?: unknown }).joinId
	if (joinId === undefined) return undefined
	return typeof joinId === 'string' && joinId.length > 0 && joinId.length <= 1024 ? joinId : null
}

function readCredentialGeneration(body: unknown) {
	if (typeof body !== 'object' || body === null) return null
	const generation = (body as { credentialGeneration?: unknown }).credentialGeneration
	return typeof generation === 'number' && Number.isSafeInteger(generation) && generation >= 0
		? generation
		: null
}

function response(body: object, status: number, headers?: Record<string, string>) {
	return Response.json(body, {
		status,
		headers: { 'Cache-Control': 'no-store', ...headers },
	})
}
