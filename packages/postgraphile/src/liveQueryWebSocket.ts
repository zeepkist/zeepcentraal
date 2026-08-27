import { Buffer } from 'node:buffer'
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
	needsInitial: boolean
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
	lastResultFingerprint?: string
	lastResultLength?: number
	replay?: string
	replayBytes: number
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
	pendingMessages: number
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
	maxPendingMessagesPerConnection: number
	resultCacheMaxBytes: number
	maxResultBytes: number
	onActiveChange?: (active: boolean) => void
	onActiveOperationsChange?: (activeOperations: number) => void
	onActiveSharedOperationsChange?: (activeSharedOperations: number) => void
	onQueueDepthChange?: (queueDepth: number) => void
	onRunningExecutionsChange?: (runningExecutions: number) => void
	onCachedResultBytesChange?: (cachedResultBytes: number) => void
	onDeduplication?: () => void
	onExecution?: (durationMs: number, outcome: 'success' | 'error') => void
	onRejected?: (
		reason:
			| 'global_limit'
			| 'connection_limit'
			| 'cost'
			| 'introspection'
			| 'invalid'
			| 'message_backlog'
			| 'result_size',
	) => void
}

export function createLiveQueryWebSocketHandlers(config: LiveQueryWebSocketConfig) {
	const states = new WeakMap<ElysiaWebSocket, WebSocketState>()
	const schema = Promise.resolve(config.schema)
	const sharedOperations = new Map<string, SharedOperation>()
	const initialQueue: SharedOperation[] = []
	const rerunQueue: SharedOperation[] = []
	const replayOrder = new Map<string, SharedOperation>()
	const runningPromises = new Set<Promise<void>>()
	let activeOperations = 0
	let pendingOperations = 0
	let runningExecutions = 0
	let debounce: Timer | undefined
	let cachedResultBytes = 0
	let disposed = false

	function updateCachedResultBytes() {
		config.onCachedResultBytesChange?.(cachedResultBytes)
	}

	function clearReplay(operation: SharedOperation) {
		if (operation.replay === undefined) return
		replayOrder.delete(operation.key)
		cachedResultBytes -= operation.replayBytes
		operation.replay = undefined
		operation.replayBytes = 0
		updateCachedResultBytes()
	}

	function cacheReplay(operation: SharedOperation, result: string) {
		clearReplay(operation)
		const bytes = result.length * 2
		if (bytes > config.resultCacheMaxBytes) return

		while (cachedResultBytes + bytes > config.resultCacheMaxBytes) {
			const oldest = replayOrder.values().next().value
			if (!oldest) break
			clearReplay(oldest)
		}

		operation.replay = result
		operation.replayBytes = bytes
		replayOrder.set(operation.key, operation)
		cachedResultBytes += bytes
		updateCachedResultBytes()
	}

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
			clearReplay(shared)
			shared.lastResultFingerprint = undefined
			shared.lastResultLength = undefined
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
		if (disposed || operation.subscribers.size === 0) {
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
		while (!disposed && runningExecutions < config.maxConcurrentExecutions) {
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
			const execution = executeOperation(operation)
			runningPromises.add(execution)
			void execution.finally(() => {
				runningPromises.delete(execution)
				operation.running = false
				runningExecutions -= 1
				config.onRunningExecutionsChange?.(runningExecutions)

				if (operation.rerunAfterExecution && operation.subscribers.size > 0) {
					operation.rerunAfterExecution = false
					enqueue(operation, 'rerun')
				} else {
					operation.rerunAfterExecution = false
				}

				if (!disposed) pumpQueue()
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
			const resultKey = JSON.stringify(result) ?? 'null'
			if (Buffer.byteLength(resultKey) > config.maxResultBytes) {
				config.onRejected?.('result_size')
				for (const subscriber of [...operation.subscribers]) {
					sendProtocolError(
						subscriber.state,
						subscriber.id,
						`Live query result exceeds ${config.maxResultBytes} byte limit`,
					)
					deleteOperation(subscriber.state, subscriber.id)
				}
				config.onExecution?.(performance.now() - startedAt, 'error')
				return
			}

			const fingerprint = Bun.hash(resultKey).toString()
			const changed =
				operation.lastResultFingerprint !== fingerprint ||
				operation.lastResultLength !== resultKey.length

			if (
				operation.subscribers.size > 0 &&
				sharedOperations.get(operation.key) === operation &&
				(changed ||
					[...operation.subscribers].some((subscriber) => subscriber.needsInitial))
			) {
				operation.lastResultFingerprint = fingerprint
				operation.lastResultLength = resultKey.length
				cacheReplay(operation, resultKey)
				for (const subscriber of operation.subscribers) {
					if (
						(changed || subscriber.needsInitial) &&
						subscriber.state.operations.get(subscriber.id) === subscriber
					) {
						sendSerializedResult(subscriber.state, subscriber.id, resultKey)
						subscriber.needsInitial = false
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
		if (disposed) return
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
					pendingMessages: 0,
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
					if (websocketState.pendingMessages >= config.maxPendingMessagesPerConnection) {
						config.onRejected?.('message_backlog')
						ws.close(4429, 'Too many pending websocket messages')
						return
					}
					websocketState.pendingMessages += 1
					websocketState.messageChain = websocketState.messageChain
						.then(processMessage)
						.catch(handleError)
						.finally(() => {
							websocketState.pendingMessages -= 1
						})
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
		async dispose() {
			if (disposed) return
			disposed = true
			if (debounce) clearTimeout(debounce)
			debounce = undefined
			initialQueue.length = 0
			rerunQueue.length = 0
			updateQueueDepth()
			for (const operation of [...sharedOperations.values()]) {
				for (const subscriber of [...operation.subscribers]) {
					subscriber.state.closed = true
					deleteOperation(subscriber.state, subscriber.id)
				}
			}
			await Promise.allSettled([...runningPromises])
			for (const operation of sharedOperations.values()) clearReplay(operation)
			sharedOperations.clear()
			replayOrder.clear()
			cachedResultBytes = 0
			updateCachedResultBytes()
		},
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
					replayBytes: 0,
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
				needsInitial: true,
				state,
				shared,
			}
			state.operations.set(message.id, subscription)
			shared.subscribers.add(subscription)
			setActiveDelta(1)

			if (shared.replay !== undefined) {
				sendSerializedResult(state, message.id, shared.replay)
				subscription.needsInitial = false
				replayOrder.delete(shared.key)
				replayOrder.set(shared.key, shared)
			}

			if (!shared.running && !shared.queued && subscription.needsInitial) {
				enqueue(shared, 'initial')
			}
		} finally {
			if (!replacesOperation) {
				pendingOperations -= 1
			}
		}
	}
}
