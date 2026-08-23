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
	sendSerializedResult,
	type WebSocketProtocol,
} from './liveQueryProtocol'
import type { QueryCostEvaluator } from './middleware/createQueryCostMiddleware'
import { stableStringify } from './stableJson'

type ElysiaWebSocket = {
	data: { request: Request; liveQueryState?: WebSocketState }
	send(message: unknown): unknown
	close(code?: number, reason?: string): unknown
}

type LiveSubscription = {
	id: string
	state: WebSocketState
	shared: SharedOperation
}

type QueueKind = 'initial' | 'rerun'

type SharedOperation = {
	key: string
	request: Request
	query: string
	variables?: unknown
	operationName?: string
	subscribers: Set<LiveSubscription>
	lastResult?: string
	running: boolean
	queued?: QueueKind
	rerunAfterExecution: boolean
}

type WebSocketState = {
	ws: ElysiaWebSocket
	request: Request
	protocol: WebSocketProtocol
	operations: Map<string, LiveSubscription>
	messageChain: Promise<void>
	closed: boolean
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
	evaluateQueryCost?: QueryCostEvaluator
	getExecutionScopeKey?: (request: Request) => string | Promise<string>
	debounceMs: number
	maxOperations: number
	maxOperationsPerConnection: number
	maxConcurrentExecutions: number
	onActiveChange?: (active: boolean) => void
	onActiveOperationsChange?: (activeOperations: number) => void
	onActiveSharedOperationsChange?: (activeSharedOperations: number) => void
	onQueueDepthChange?: (queueDepth: number) => void
	onRunningExecutionsChange?: (runningExecutions: number) => void
	onDeduplication?: () => void
	onExecution?: (durationMs: number, outcome: 'success' | 'error') => void
	onRejected?: (
		reason: 'global_limit' | 'connection_limit' | 'cost' | 'introspection' | 'invalid',
	) => void
}

export function createLiveQueryWebSocketHandlers(config: LiveQueryWebSocketConfig) {
	const states = new WeakMap<ElysiaWebSocket, WebSocketState>()
	const schema = Promise.resolve(config.schema)
	const sharedOperations = new Map<string, SharedOperation>()
	const initialQueue: SharedOperation[] = []
	const rerunQueue: SharedOperation[] = []
	let activeOperations = 0
	let pendingOperations = 0
	let runningExecutions = 0
	let debounce: Timer | undefined

	function setActiveDelta(delta: 1 | -1) {
		const wasActive = activeOperations > 0
		activeOperations += delta
		config.onActiveOperationsChange?.(activeOperations)
		const isActive = activeOperations > 0

		if (wasActive !== isActive) {
			config.onActiveChange?.(isActive)
		}

		if (!isActive && debounce) {
			clearTimeout(debounce)
			debounce = undefined
		}
	}

	function deleteOperation(state: WebSocketState, id: string) {
		const subscription = state.operations.get(id)
		if (!subscription || !state.operations.delete(id)) {
			return
		}

		const { shared } = subscription
		shared.subscribers.delete(subscription)
		setActiveDelta(-1)

		if (shared.subscribers.size === 0 && sharedOperations.get(shared.key) === shared) {
			sharedOperations.delete(shared.key)
			removeQueuedOperation(shared)
			shared.lastResult = undefined
			config.onActiveSharedOperationsChange?.(sharedOperations.size)
		}
	}

	function updateQueueDepth() {
		config.onQueueDepthChange?.(initialQueue.length + rerunQueue.length)
	}

	function removeQueuedOperation(operation: SharedOperation) {
		if (!operation.queued) {
			return
		}

		const queue = operation.queued === 'initial' ? initialQueue : rerunQueue
		const index = queue.indexOf(operation)
		if (index >= 0) {
			queue.splice(index, 1)
		}
		operation.queued = undefined
		updateQueueDepth()
	}

	function enqueue(operation: SharedOperation, kind: QueueKind) {
		if (operation.subscribers.size === 0) {
			return
		}

		if (operation.running) {
			if (kind === 'rerun') {
				operation.rerunAfterExecution = true
			}
			return
		}

		if (operation.queued) {
			return
		}

		operation.queued = kind
		if (kind === 'initial') {
			initialQueue.push(operation)
		} else {
			rerunQueue.push(operation)
		}
		updateQueueDepth()
		pumpQueue()
	}

	function nextQueuedOperation() {
		const operation = initialQueue.shift() ?? rerunQueue.shift()
		if (operation) {
			operation.queued = undefined
			updateQueueDepth()
		}
		return operation
	}

	function pumpQueue() {
		while (runningExecutions < config.maxConcurrentExecutions) {
			const operation = nextQueuedOperation()
			if (!operation) {
				return
			}

			if (
				operation.subscribers.size === 0 ||
				sharedOperations.get(operation.key) !== operation
			) {
				continue
			}

			operation.running = true
			runningExecutions += 1
			config.onRunningExecutionsChange?.(runningExecutions)
			void executeOperation(operation).finally(() => {
				operation.running = false
				runningExecutions -= 1
				config.onRunningExecutionsChange?.(runningExecutions)

				if (operation.rerunAfterExecution && operation.subscribers.size > 0) {
					operation.rerunAfterExecution = false
					enqueue(operation, 'rerun')
				} else {
					operation.rerunAfterExecution = false
				}

				pumpQueue()
			})
		}
	}

	async function executeOperation(operation: SharedOperation) {
		const startedAt = performance.now()
		try {
			const result = await config.execute(operation.request, {
				query: operation.query,
				variables: operation.variables,
				operationName: operation.operationName,
			})
			const resultKey = stableStringify(result)

			if (
				operation.subscribers.size > 0 &&
				sharedOperations.get(operation.key) === operation &&
				resultKey !== operation.lastResult
			) {
				operation.lastResult = resultKey
				for (const subscriber of operation.subscribers) {
					if (subscriber.state.operations.get(subscriber.id) === subscriber) {
						sendSerializedResult(subscriber.state, subscriber.id, resultKey)
					}
				}
			}
			config.onExecution?.(performance.now() - startedAt, 'success')
		} catch (error) {
			for (const subscriber of operation.subscribers) {
				if (subscriber.state.operations.get(subscriber.id) !== subscriber) {
					continue
				}

				sendProtocolError(
					subscriber.state,
					subscriber.id,
					error instanceof Error
						? error.message
						: 'Unexpected live query execution error',
				)
			}
			config.onExecution?.(performance.now() - startedAt, 'error')
		}
	}

	function rerunAll() {
		debounce = undefined
		for (const operation of sharedOperations.values()) {
			enqueue(operation, 'rerun')
		}
	}

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
					messageChain: Promise.resolve(),
					closed: false,
				}
				states.set(ws, state)
				ws.data.liveQueryState = state
			},
			message(ws: ElysiaWebSocket, rawMessage: unknown) {
				const state = ws.data.liveQueryState ?? states.get(ws)
				if (!state) {
					return
				}
				const websocketState = state

				const message = parseMessage(rawMessage)
				if (!message) {
					ws.close(4400, 'Malformed websocket message')
					return
				}

				const processMessage = () => handleMessage(websocketState, message)
				if (
					message.type === 'subscribe' ||
					message.type === 'start' ||
					message.type === 'complete' ||
					message.type === 'stop'
				) {
					websocketState.messageChain = websocketState.messageChain
						.then(processMessage)
						.catch(handleError)
				} else {
					void processMessage().catch(handleError)
				}

				function handleError(error: unknown) {
					if (!websocketState.closed) {
						sendProtocolError(
							websocketState,
							undefined,
							error instanceof Error ? error.message : 'Unexpected live query error',
						)
					}
				}
			},
			close(ws: ElysiaWebSocket) {
				const state = ws.data.liveQueryState ?? states.get(ws)
				if (!state) {
					return
				}

				state.closed = true
				for (const operationId of state.operations.keys()) {
					deleteOperation(state, operationId)
				}
				states.delete(ws)
				ws.data.liveQueryState = undefined
			},
		},
		invalidate: scheduleRerunAll,
	}

	async function handleMessage(state: WebSocketState, message: ClientMessage) {
		if (state.closed) {
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
			config.onRejected?.('invalid')
			sendProtocolError(state, undefined, 'Subscribe message requires string id')
			return
		}

		const replacesOperation = state.operations.has(message.id)
		if (activeOperations + pendingOperations >= config.maxOperations && !replacesOperation) {
			config.onRejected?.('global_limit')
			sendProtocolError(state, message.id, 'Too many live query operations')
			return
		}

		if (
			state.operations.size >= config.maxOperationsPerConnection &&
			!state.operations.has(message.id)
		) {
			config.onRejected?.('connection_limit')
			sendProtocolError(
				state,
				message.id,
				'Too many live query operations on this connection',
			)
			return
		}

		if (!replacesOperation) {
			pendingOperations += 1
		}

		try {
			const payload = normalizePayload(message.payload)
			if (!payload) {
				config.onRejected?.('invalid')
				sendProtocolError(state, message.id, 'Subscribe payload requires query')
				return
			}

			const queryCost = await config.evaluateQueryCost?.(payload)
			if (state.closed) {
				return
			}

			if (queryCost?.kind === 'rejected') {
				config.onRejected?.(queryCost.reason === 'cost' ? 'cost' : 'invalid')
				sendProtocolError(
					state,
					message.id,
					queryCost.details
						? `${queryCost.message}: ${queryCost.details}`
						: (queryCost.message ?? 'Invalid GraphQL subscription'),
				)
				return
			}

			if (queryCost?.kind === 'introspection') {
				config.onRejected?.('introspection')
				sendProtocolError(
					state,
					message.id,
					'Live query websocket does not accept introspection operations',
				)
				return
			}

			const prepared = await prepareLiveQuery(schema, payload)
			if (state.closed) {
				return
			}

			if ('error' in prepared) {
				config.onRejected?.('invalid')
				sendProtocolError(state, message.id, prepared.error)
				return
			}

			const executionScopeKey =
				(await config.getExecutionScopeKey?.(state.request)) ?? 'public'
			if (state.closed) {
				return
			}

			const operationKey = stableStringify({
				executionScopeKey,
				operationName: payload.operationName ?? null,
				query: prepared.query,
				variables: payload.variables ?? null,
			})

			deleteOperation(state, message.id)

			let shared = sharedOperations.get(operationKey)
			if (!shared) {
				shared = {
					key: operationKey,
					request: createExecutionRequest(state.request),
					query: prepared.query,
					variables: payload.variables,
					operationName: payload.operationName,
					subscribers: new Set(),
					running: false,
					rerunAfterExecution: false,
				}
				sharedOperations.set(operationKey, shared)
				config.onActiveSharedOperationsChange?.(sharedOperations.size)
			} else {
				config.onDeduplication?.()
			}

			const subscription: LiveSubscription = {
				id: message.id,
				state,
				shared,
			}
			state.operations.set(message.id, subscription)
			shared.subscribers.add(subscription)
			setActiveDelta(1)

			if (shared.lastResult !== undefined) {
				sendSerializedResult(state, message.id, shared.lastResult)
			}

			if (!shared.running && !shared.queued && shared.lastResult === undefined) {
				enqueue(shared, 'initial')
			}
		} finally {
			if (!replacesOperation) {
				pendingOperations -= 1
			}
		}
	}
}
