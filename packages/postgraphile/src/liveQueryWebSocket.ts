import type { GraphQLSchema } from 'postgraphile/graphql'
import { prepareLiveQuery } from './liveQueryOperation'
import {
	type ClientMessage,
	createExecutionRequest,
	type GraphqlPayload,
	normalizePayload,
	type ProtocolState,
	parseMessage,
	resolveProtocol,
	selectProtocolHeader,
	send,
	sendProtocolError,
	sendResult,
	type WebSocketProtocol,
} from './liveQueryProtocol'
import { stableStringify } from './stableJson'

type ElysiaWebSocket = {
	data: { request: Request; liveQueryState?: WebSocketState }
	send(message: unknown): unknown
	close(code?: number, reason?: string): unknown
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
} & ProtocolState

type WebSocketUpgradeContext = {
	request: Request
	set: {
		headers: Record<string, string | number>
	}
}

type LiveQueryWebSocketConfig = {
	schema: GraphQLSchema | Promise<GraphQLSchema>
	execute: (request: Request, body: GraphqlPayload) => Promise<unknown>
	debounceMs: number
	maxOperations: number
	onActiveChange?: (active: boolean) => void
	onActiveOperationsChange?: (activeOperations: number) => void
}

export function createLiveQueryWebSocketHandlers(config: LiveQueryWebSocketConfig) {
	const states = new WeakMap<ElysiaWebSocket, WebSocketState>()
	const schema = Promise.resolve(config.schema)
	let activeOperations = 0
	let debounce: Timer | undefined

	function setActiveDelta(delta: 1 | -1) {
		const wasActive = activeOperations > 0
		activeOperations += delta
		config.onActiveOperationsChange?.(activeOperations)
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

		const prepared = await prepareLiveQuery(schema, payload)
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
}
