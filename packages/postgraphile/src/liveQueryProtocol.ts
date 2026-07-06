export type GraphqlPayload = {
	query: string
	variables?: unknown
	operationName?: string
}

export type ClientMessage = {
	id?: unknown
	type?: unknown
	payload?: unknown
}

export type WebSocketProtocol = 'graphql-transport-ws' | 'subscriptions-transport-ws'

export type ProtocolState = {
	protocol: WebSocketProtocol
	ws: {
		send(message: unknown): unknown
	}
}

export function parseMessage(rawMessage: unknown): ClientMessage | undefined {
	if (
		rawMessage &&
		typeof rawMessage === 'object' &&
		!(rawMessage instanceof ArrayBuffer) &&
		!ArrayBuffer.isView(rawMessage)
	) {
		return rawMessage as ClientMessage
	}

	try {
		const text =
			typeof rawMessage === 'string'
				? rawMessage
				: rawMessage instanceof ArrayBuffer || ArrayBuffer.isView(rawMessage)
					? new TextDecoder().decode(rawMessage as ArrayBuffer)
					: String(rawMessage)
		const value = JSON.parse(text) as ClientMessage
		return value && typeof value === 'object' ? value : undefined
	} catch {
		return undefined
	}
}

export function normalizePayload(payload: unknown): GraphqlPayload | undefined {
	if (!payload || typeof payload !== 'object') {
		return undefined
	}

	const next = payload as GraphqlPayload
	if (typeof next.query !== 'string') {
		return undefined
	}

	return {
		query: next.query,
		variables: next.variables,
		operationName: typeof next.operationName === 'string' ? next.operationName : undefined,
	}
}

export function createExecutionRequest(request: Request) {
	const headers = new Headers(request.headers)
	headers.set('content-type', 'application/json')
	headers.delete('connection')
	headers.delete('upgrade')
	headers.delete('sec-websocket-extensions')
	headers.delete('sec-websocket-key')
	headers.delete('sec-websocket-protocol')
	headers.delete('sec-websocket-version')

	return new Request(new URL('/', request.url).toString(), {
		method: 'POST',
		headers,
	})
}

export function send(state: ProtocolState, message: unknown) {
	state.ws.send(JSON.stringify(message))
}

export function sendProtocolError(state: ProtocolState, id: string | undefined, message: string) {
	if (state.protocol === 'subscriptions-transport-ws') {
		send(state, {
			...(id ? { id } : null),
			type: 'error',
			payload: { message },
		})
		return
	}

	send(state, {
		...(id ? { id } : null),
		type: 'error',
		payload: [{ message }],
	})
}

export function sendResult(state: ProtocolState, id: string, payload: unknown) {
	send(state, {
		id,
		type: state.protocol === 'subscriptions-transport-ws' ? 'data' : 'next',
		payload,
	})
}

export function resolveProtocol(request: Request): WebSocketProtocol {
	const protocols = getRequestedProtocols(request)

	return protocols.includes('graphql-ws') || protocols.includes('subscriptions-transport-ws')
		? 'subscriptions-transport-ws'
		: 'graphql-transport-ws'
}

export function selectProtocolHeader(request: Request): string | undefined {
	const protocols = getRequestedProtocols(request)

	if (protocols.includes('graphql-transport-ws')) {
		return 'graphql-transport-ws'
	}

	if (protocols.includes('graphql-ws')) {
		return 'graphql-ws'
	}

	if (protocols.includes('subscriptions-transport-ws')) {
		return 'subscriptions-transport-ws'
	}

	return undefined
}

function getRequestedProtocols(request: Request) {
	return (request.headers.get('sec-websocket-protocol') ?? '')
		.split(',')
		.map((protocol) => protocol.trim())
		.filter(Boolean)
}
