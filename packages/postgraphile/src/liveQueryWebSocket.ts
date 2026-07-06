import {
	type DocumentNode,
	type GraphQLSchema,
	type OperationDefinitionNode,
	parse,
	print,
	validate,
} from 'postgraphile/graphql'

type ElysiaWebSocket = {
	data: { request: Request; liveQueryState?: WebSocketState }
	send(message: unknown): unknown
	close(code?: number, reason?: string): unknown
}

type GraphqlPayload = {
	query: string
	variables?: unknown
	operationName?: string
}

type LiveOperation = {
	id: string
	query: string
	variables?: unknown
	operationName?: string
	lastResult?: string
	running: boolean
	pending: boolean
}

type WebSocketState = {
	ws: ElysiaWebSocket
	request: Request
	protocol: WebSocketProtocol
	operations: Map<string, LiveOperation>
}

type LiveQueryWebSocketConfig = {
	schema: GraphQLSchema | Promise<GraphQLSchema>
	execute: (request: Request, body: GraphqlPayload) => Promise<unknown>
	debounceMs: number
	maxOperations: number
	onActiveChange?: (active: boolean) => void
}

type ClientMessage = {
	id?: unknown
	type?: unknown
	payload?: unknown
}

type WebSocketProtocol = 'graphql-transport-ws' | 'subscriptions-transport-ws'

type WebSocketUpgradeContext = {
	request: Request
	set: {
		headers: Record<string, string | number>
	}
}

export function createLiveQueryWebSocketHandlers(config: LiveQueryWebSocketConfig) {
	const states = new WeakMap<ElysiaWebSocket, WebSocketState>()
	const schema = Promise.resolve(config.schema)
	let activeOperations = 0
	let debounce: Timer | undefined

	function setActiveDelta(delta: 1 | -1) {
		const wasActive = activeOperations > 0
		activeOperations += delta
		const isActive = activeOperations > 0

		if (wasActive !== isActive) {
			config.onActiveChange?.(isActive)
		}
	}

	function deleteOperation(state: WebSocketState, id: string) {
		if (!state.operations.delete(id)) {
			return
		}

		setActiveDelta(-1)
	}

	async function executeOperation(state: WebSocketState, operation: LiveOperation) {
		if (operation.running) {
			operation.pending = true
			return
		}

		operation.running = true
		try {
			do {
				operation.pending = false
				const result = await config.execute(createExecutionRequest(state.request), {
					query: operation.query,
					variables: operation.variables,
					operationName: operation.operationName,
				})
				const resultKey = stableStringify(result)

				if (!state.operations.has(operation.id) || resultKey === operation.lastResult) {
					continue
				}

				operation.lastResult = resultKey
				sendResult(state, operation.id, result)
			} while (operation.pending)
		} catch (error) {
			if (state.operations.has(operation.id)) {
				sendProtocolError(
					state,
					operation.id,
					error instanceof Error
						? error.message
						: 'Unexpected live query execution error',
				)
			}
		} finally {
			operation.running = false
		}
	}

	function rerunAll() {
		for (const state of activeStates) {
			for (const operation of state.operations.values()) {
				void executeOperation(state, operation)
			}
		}
	}

	const activeStates = new Set<WebSocketState>()

	function scheduleRerunAll() {
		if (debounce) {
			clearTimeout(debounce)
		}

		debounce = setTimeout(rerunAll, config.debounceMs)
	}

	return {
		handlers: {
			upgrade(context: WebSocketUpgradeContext) {
				const protocol = selectProtocolHeader(context.request)
				if (protocol) {
					context.set.headers['sec-websocket-protocol'] = protocol
				}
			},
			open(ws: ElysiaWebSocket) {
				const state: WebSocketState = {
					ws,
					request: ws.data.request,
					protocol: resolveProtocol(ws.data.request),
					operations: new Map(),
				}
				states.set(ws, state)
				ws.data.liveQueryState = state
				activeStates.add(state)
			},
			message(ws: ElysiaWebSocket, rawMessage: unknown) {
				const state = ws.data.liveQueryState ?? states.get(ws)
				if (!state) {
					return
				}

				void handleMessage(ws, state, rawMessage).catch((error) => {
					sendProtocolError(
						state,
						undefined,
						error instanceof Error ? error.message : 'Unexpected live query error',
					)
				})
			},
			close(ws: ElysiaWebSocket) {
				const state = ws.data.liveQueryState ?? states.get(ws)
				if (!state) {
					return
				}

				for (const operationId of state.operations.keys()) {
					deleteOperation(state, operationId)
				}
				activeStates.delete(state)
				states.delete(ws)
				ws.data.liveQueryState = undefined
			},
		},
		invalidate: scheduleRerunAll,
	}

	async function handleMessage(ws: ElysiaWebSocket, state: WebSocketState, rawMessage: unknown) {
		const message = parseMessage(rawMessage)
		if (!message) {
			ws.close(4400, 'Malformed websocket message')
			return
		}

		switch (message.type) {
			case 'connection_init':
				send(state, { type: 'connection_ack' })
				return
			case 'ping':
				send(state, { type: 'pong' })
				return
			case 'subscribe':
				state.protocol = 'graphql-transport-ws'
				await subscribe(state, message)
				return
			case 'start':
				state.protocol = 'subscriptions-transport-ws'
				await subscribe(state, message)
				return
			case 'complete':
			case 'stop':
				if (typeof message.id === 'string') {
					deleteOperation(state, message.id)
				}
				return
		}
	}

	async function subscribe(state: WebSocketState, message: ClientMessage) {
		if (typeof message.id !== 'string') {
			sendProtocolError(state, undefined, 'Subscribe message requires string id')
			return
		}

		if (activeOperations >= config.maxOperations && !state.operations.has(message.id)) {
			sendProtocolError(state, message.id, 'Too many live query operations')
			return
		}

		const payload = normalizePayload(message.payload)
		if (!payload) {
			sendProtocolError(state, message.id, 'Subscribe payload requires query')
			return
		}

		const prepared = await prepareLiveQuery(payload)
		if ('error' in prepared) {
			sendProtocolError(state, message.id, prepared.error)
			return
		}

		deleteOperation(state, message.id)

		const operation: LiveOperation = {
			id: message.id,
			query: prepared.query,
			variables: payload.variables,
			operationName: payload.operationName,
			running: false,
			pending: false,
		}
		state.operations.set(message.id, operation)
		setActiveDelta(1)
		await executeOperation(state, operation)
	}

	async function prepareLiveQuery(payload: GraphqlPayload): Promise<PrepareResult> {
		try {
			const document = parse(payload.query)
			const operation = findOperation(document, payload.operationName)
			if (!operation) {
				return { error: 'GraphQL operation not found' }
			}

			if (operation.operation !== 'subscription') {
				return { error: 'Live query websocket only accepts subscription operations' }
			}

			const validationErrors = validate(await schema, document)
			if (validationErrors.length > 0) {
				return { error: validationErrors[0]?.message ?? 'Invalid GraphQL subscription' }
			}

			return { query: print(rewriteSubscriptionAsQuery(document, operation)) }
		} catch (error) {
			return {
				error: error instanceof Error ? error.message : 'Invalid GraphQL subscription',
			}
		}
	}
}

function parseMessage(rawMessage: unknown): ClientMessage | undefined {
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

function normalizePayload(payload: unknown): GraphqlPayload | undefined {
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

function findOperation(document: DocumentNode, operationName: unknown) {
	const operations = document.definitions.filter(
		(definition): definition is OperationDefinitionNode =>
			definition.kind === 'OperationDefinition',
	)

	if (typeof operationName === 'string') {
		return operations.find((operation) => operation.name?.value === operationName)
	}

	return operations.length === 1 ? operations[0] : undefined
}

function rewriteSubscriptionAsQuery(
	document: DocumentNode,
	selectedOperation: OperationDefinitionNode,
): DocumentNode {
	return {
		...document,
		definitions: document.definitions.map((definition) => {
			if (definition !== selectedOperation) {
				return definition
			}

			return {
				...definition,
				operation: 'query',
			} as OperationDefinitionNode
		}),
	}
}

function createExecutionRequest(request: Request) {
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

function send(state: WebSocketState, message: unknown) {
	state.ws.send(JSON.stringify(message))
}

function sendProtocolError(state: WebSocketState, id: string | undefined, message: string) {
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

function sendResult(state: WebSocketState, id: string, payload: unknown) {
	send(state, {
		id,
		type: state.protocol === 'subscriptions-transport-ws' ? 'data' : 'next',
		payload,
	})
}

function resolveProtocol(request: Request): WebSocketProtocol {
	const protocols = getRequestedProtocols(request)

	return protocols.includes('graphql-ws') || protocols.includes('subscriptions-transport-ws')
		? 'subscriptions-transport-ws'
		: 'graphql-transport-ws'
}

function selectProtocolHeader(request: Request): string | undefined {
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

function stableStringify(value: unknown): string {
	return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortValue)
	}

	if (!value || typeof value !== 'object') {
		return value
	}

	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entryValue]) => [key, sortValue(entryValue)]),
	)
}

type PrepareResult =
	| {
			query: string
	  }
	| {
			error: string
	  }
