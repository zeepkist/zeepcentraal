import { describe, expect, test } from 'bun:test'
import { buildSchema } from 'postgraphile/graphql'
import { createLiveQueryWebSocketHandlers } from './liveQueryWebSocket'
import {
	createQueryCostEvaluator,
	type QueryCostEvaluator,
} from './middleware/createQueryCostMiddleware'

type SentMessage = {
	id?: string
	type: string
	payload?: unknown
}

function createWebSocket(protocol = 'graphql-transport-ws', headers: Record<string, string> = {}) {
	const sent: SentMessage[] = []
	let closeCode: number | undefined
	let closeReason: string | undefined

	return {
		ws: {
			data: {
				request: new Request('http://localhost/', {
					headers: {
						...headers,
						connection: 'Upgrade',
						'sec-websocket-key': 'test-key',
						'sec-websocket-protocol': protocol,
						upgrade: 'websocket',
					},
				}),
			},
			send(message: unknown) {
				sent.push(JSON.parse(String(message)) as SentMessage)
			},
			close(code?: number, reason?: string) {
				closeCode = code
				closeReason = reason
			},
		},
		sent,
		get closeCode() {
			return closeCode
		},
		get closeReason() {
			return closeReason
		},
	}
}

type HandlerOptions = {
	maxOperationsPerConnection?: number
	maxConcurrentExecutions?: number
	maxPendingMessagesPerConnection?: number
	resultCacheMaxBytes?: number
	maxResultBytes?: number
	evaluateQueryCost?: QueryCostEvaluator
	getExecutionScopeKey?: (request: Request) => string | Promise<string>
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

function createHandlers(
	execute: (
		body: { query: string; variables?: unknown; operationName?: string },
		request: Request,
	) => unknown,
	onActiveChange?: (active: boolean) => void,
	maxOperations = 10,
	onActiveOperationsChange?: (activeOperations: number) => void,
	options: HandlerOptions = {},
) {
	return createLiveQueryWebSocketHandlers({
		schema: buildSchema(`
			type RecordsConnection {
				totalCount: Int
				nodes: [Record!]!
			}

			type Record {
				id: Int!
				time: Int
			}

			type Query {
				records(first: Int): RecordsConnection
			}

			type Subscription {
				records(first: Int): RecordsConnection
			}
		`),
		debounceMs: 1,
		maxOperations,
		maxOperationsPerConnection: options.maxOperationsPerConnection ?? maxOperations,
		maxConcurrentExecutions: options.maxConcurrentExecutions ?? 4,
		maxPendingMessagesPerConnection: options.maxPendingMessagesPerConnection ?? 32,
		resultCacheMaxBytes: options.resultCacheMaxBytes ?? 16 * 1024 * 1024,
		maxResultBytes: options.maxResultBytes ?? 2 * 1024 * 1024,
		evaluateQueryCost: options.evaluateQueryCost,
		getExecutionScopeKey: options.getExecutionScopeKey,
		onActiveChange,
		onActiveOperationsChange,
		onActiveSharedOperationsChange: options.onActiveSharedOperationsChange,
		onQueueDepthChange: options.onQueueDepthChange,
		onRunningExecutionsChange: options.onRunningExecutionsChange,
		onCachedResultBytesChange: options.onCachedResultBytesChange,
		onDeduplication: options.onDeduplication,
		onExecution: options.onExecution,
		onRejected: options.onRejected,
		async execute(_request, body) {
			return execute(body, _request)
		},
	})
}

function subscribe(id: string, query: string, variables?: unknown, operationName?: string) {
	return JSON.stringify({
		id,
		type: 'subscribe',
		payload: { query, variables, operationName },
	})
}

function getFirstVariable(variables: unknown) {
	return Number((variables as { first?: unknown } | undefined)?.first)
}

describe('createLiveQueryWebSocketHandlers', () => {
	test('acks connection init', async () => {
		const { handlers } = createHandlers(() => ({ data: {} }))
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(socket.ws, JSON.stringify({ type: 'connection_init' }))

		expect(socket.sent).toEqual([{ type: 'connection_ack' }])
	})

	test('accepts Elysia parsed object messages', async () => {
		const { handlers } = createHandlers(() => ({ data: {} }))
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(socket.ws, { type: 'connection_init' })

		expect(socket.sent).toEqual([{ type: 'connection_ack' }])
	})

	test('valid subscription sends initial next and rewrites operation to query', async () => {
		let executedQuery = ''
		let executionRequest: Request | undefined
		const { handlers } = createHandlers((body, request) => {
			executedQuery = body.query
			executionRequest = request
			return { data: { records: { totalCount: 1, nodes: [{ id: 1, time: 123 }] } } }
		})
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			JSON.stringify({
				id: '1',
				type: 'subscribe',
				payload: {
					query: 'subscription MySubscription { records(first: 1) { totalCount nodes { id time } } }',
				},
			}),
		)
		await Bun.sleep(1)

		expect(executedQuery).toStartWith('query MySubscription')
		expect(executionRequest?.headers.get('upgrade')).toBeNull()
		expect(executionRequest?.headers.get('sec-websocket-protocol')).toBeNull()
		expect(socket.sent).toEqual([
			{
				id: '1',
				type: 'next',
				payload: {
					data: { records: { totalCount: 1, nodes: [{ id: 1, time: 123 }] } },
				},
			},
		])
	})

	test('shares one initial execution across 100 duplicate websocket subscriptions', async () => {
		let executions = 0
		let deduplicationHits = 0
		const sharedCounts: number[] = []
		const { handlers } = createHandlers(
			() => {
				executions += 1
				return { data: { records: { totalCount: 1, nodes: [{ id: 1 }] } } }
			},
			undefined,
			512,
			undefined,
			{
				onDeduplication: () => {
					deduplicationHits += 1
				},
				onActiveSharedOperationsChange: (count) => sharedCounts.push(count),
			},
		)
		const sockets = Array.from({ length: 100 }, () => createWebSocket())
		const query = 'subscription Shared { records(first: 1) { totalCount nodes { id } } }'

		for (const [index, socket] of sockets.entries()) {
			handlers.open(socket.ws)
			handlers.message(socket.ws, subscribe(String(index), query))
		}
		await Bun.sleep(10)

		expect(executions).toBe(1)
		expect(deduplicationHits).toBe(99)
		expect(sharedCounts).toEqual([1])
		expect(sockets.every((socket) => socket.sent.length === 1)).toBe(true)
	})

	test('normalizes query whitespace and variable object key order for sharing', async () => {
		let executions = 0
		const { handlers } = createHandlers(() => {
			executions += 1
			return { data: { records: { totalCount: 1, nodes: [] } } }
		})
		const first = createWebSocket()
		const second = createWebSocket()
		const firstQuery = `
			subscription Shared($first: Int) {
				records(first: $first) { totalCount }
			}
		`
		const secondQuery = 'subscription Shared($first:Int){records(first:$first){totalCount}}'

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('1', firstQuery, { first: 1, ignored: true }))
		handlers.message(second.ws, subscribe('2', secondQuery, { ignored: true, first: 1 }))
		await Bun.sleep(5)

		expect(executions).toBe(1)
		expect(first.sent).toHaveLength(1)
		expect(second.sent).toHaveLength(1)
	})

	test('keeps different operation names in separate shared groups', async () => {
		let executions = 0
		const { handlers } = createHandlers(() => {
			executions += 1
			return { data: { records: { totalCount: executions } } }
		})
		const first = createWebSocket()
		const second = createWebSocket()
		const query = `
			subscription First { records(first: 1) { totalCount } }
			subscription Second { records(first: 1) { totalCount } }
		`

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('1', query, undefined, 'First'))
		handlers.message(second.ws, subscribe('2', query, undefined, 'Second'))
		await Bun.sleep(5)

		expect(executions).toBe(2)
	})

	test('does not share different variables or execution scopes', async () => {
		let executions = 0
		const { handlers } = createHandlers(
			() => {
				executions += 1
				return { data: { records: { totalCount: 1, nodes: [] } } }
			},
			undefined,
			10,
			undefined,
			{ getExecutionScopeKey: (request) => request.headers.get('x-scope') ?? 'public' },
		)
		const query = 'subscription Shared($first: Int) { records(first: $first) { totalCount } }'
		const first = createWebSocket('graphql-transport-ws', { 'x-scope': 'public' })
		const second = createWebSocket('graphql-transport-ws', { 'x-scope': 'public' })
		const third = createWebSocket('graphql-transport-ws', { 'x-scope': 'private' })

		for (const socket of [first, second, third]) handlers.open(socket.ws)
		handlers.message(first.ws, subscribe('1', query, { first: 1 }))
		handlers.message(second.ws, subscribe('2', query, { first: 2 }))
		handlers.message(third.ws, subscribe('3', query, { first: 1 }))
		await Bun.sleep(5)

		expect(executions).toBe(3)
	})

	test('joins an in-flight shared execution and fans out its first result', async () => {
		let executions = 0
		const pending = Promise.withResolvers<unknown>()
		const { handlers } = createHandlers(async () => {
			executions += 1
			return pending.promise
		})
		const first = createWebSocket()
		const second = createWebSocket()
		const query = 'subscription Shared { records(first: 1) { totalCount } }'

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('1', query))
		handlers.message(second.ws, subscribe('2', query))
		await Bun.sleep(1)

		expect(executions).toBe(1)
		expect(first.sent).toEqual([])
		expect(second.sent).toEqual([])

		pending.resolve({ data: { records: { totalCount: 1 } } })
		await Bun.sleep(1)
		expect(first.sent).toHaveLength(1)
		expect(second.sent).toHaveLength(1)
	})

	test('serves a late duplicate subscriber from cached shared result', async () => {
		let executions = 0
		const { handlers } = createHandlers(() => {
			executions += 1
			return { data: { records: { totalCount: 1 } } }
		})
		const first = createWebSocket()
		const second = createWebSocket()
		const query = 'subscription Shared { records(first: 1) { totalCount } }'

		handlers.open(first.ws)
		handlers.message(first.ws, subscribe('first', query))
		await Bun.sleep(2)
		handlers.open(second.ws)
		handlers.message(second.ws, subscribe('second', query))
		await Bun.sleep(2)

		expect(executions).toBe(1)
		expect(second.sent).toEqual([
			{
				id: 'second',
				type: 'next',
				payload: { data: { records: { totalCount: 1 } } },
			},
		])
	})

	test('evicts replay results by retained byte budget', async () => {
		let executions = 0
		const retainedBytes: number[] = []
		const { handlers } = createHandlers(
			(_body) => {
				executions += 1
				return { data: { records: { totalCount: executions } } }
			},
			undefined,
			10,
			undefined,
			{
				resultCacheMaxBytes: 100,
				onCachedResultBytesChange: (bytes) => retainedBytes.push(bytes),
			},
		)
		const first = createWebSocket()
		const second = createWebSocket()
		const late = createWebSocket()
		const query = 'subscription Shared($first: Int) { records(first: $first) { totalCount } }'

		handlers.open(first.ws)
		handlers.message(first.ws, subscribe('first', query, { first: 1 }))
		await Bun.sleep(2)
		handlers.open(second.ws)
		handlers.message(second.ws, subscribe('second', query, { first: 2 }))
		await Bun.sleep(2)
		handlers.open(late.ws)
		handlers.message(late.ws, subscribe('late', query, { first: 1 }))
		await Bun.sleep(2)

		expect(executions).toBe(3)
		expect(Math.max(...retainedBytes)).toBeLessThanOrEqual(100)
		expect(late.sent.at(-1)?.type).toBe('next')
	})

	test('rejects oversized results and excess pending messages', async () => {
		const pendingCost = Promise.withResolvers<{ kind: 'accepted'; cost: number }>()
		const reasons: string[] = []
		const pendingHandlers = createHandlers(() => ({ data: {} }), undefined, 10, undefined, {
			evaluateQueryCost: () => pendingCost.promise,
			maxPendingMessagesPerConnection: 1,
			onRejected: (reason) => reasons.push(reason),
		})
		const pendingSocket = createWebSocket()
		pendingHandlers.handlers.open(pendingSocket.ws)
		pendingHandlers.handlers.message(
			pendingSocket.ws,
			subscribe('first', 'subscription { records(first: 1) { totalCount } }'),
		)
		pendingHandlers.handlers.message(
			pendingSocket.ws,
			subscribe('second', 'subscription { records(first: 1) { totalCount } }'),
		)
		expect(pendingSocket.closeCode).toBe(4429)
		pendingCost.resolve({ kind: 'accepted', cost: 1 })
		await Bun.sleep(2)

		const resultHandlers = createHandlers(
			() => ({ data: { records: { totalCount: 123456 } } }),
			undefined,
			10,
			undefined,
			{ maxResultBytes: 8, onRejected: (reason) => reasons.push(reason) },
		)
		const resultSocket = createWebSocket()
		resultHandlers.handlers.open(resultSocket.ws)
		resultHandlers.handlers.message(
			resultSocket.ws,
			subscribe('large', 'subscription { records(first: 1) { totalCount } }'),
		)
		await Bun.sleep(2)

		expect(resultSocket.sent.at(-1)?.type).toBe('error')
		expect(reasons).toEqual(['message_backlog', 'result_size'])
	})

	test('shares execution while preserving modern and legacy protocol envelopes', async () => {
		let executions = 0
		const { handlers } = createHandlers(() => {
			executions += 1
			return { data: { records: { totalCount: 1 } } }
		})
		const modern = createWebSocket()
		const legacy = createWebSocket('graphql-ws')
		const query = 'subscription Shared { records(first: 1) { totalCount } }'

		handlers.open(modern.ws)
		handlers.open(legacy.ws)
		handlers.message(modern.ws, subscribe('modern', query))
		handlers.message(
			legacy.ws,
			JSON.stringify({ id: 'legacy', type: 'start', payload: { query } }),
		)
		await Bun.sleep(5)

		expect(executions).toBe(1)
		expect(modern.sent[0]?.type).toBe('next')
		expect(legacy.sent[0]?.type).toBe('data')
	})

	test('legacy graphql-ws start sends initial data response', async () => {
		let executedQuery = ''
		const { handlers } = createHandlers((body) => {
			executedQuery = body.query
			return { data: { records: { totalCount: 1, nodes: [{ id: 1, time: 123 }] } } }
		})
		const socket = createWebSocket('graphql-ws')

		handlers.open(socket.ws)
		handlers.message(socket.ws, JSON.stringify({ type: 'connection_init' }))
		handlers.message(
			socket.ws,
			JSON.stringify({
				id: '1',
				type: 'start',
				payload: {
					query: 'subscription MySubscription { records(first: 1) { totalCount nodes { id time } } }',
				},
			}),
		)
		await Bun.sleep(1)

		expect(executedQuery).toStartWith('query MySubscription')
		expect(socket.sent).toEqual([
			{ type: 'connection_ack' },
			{
				id: '1',
				type: 'data',
				payload: {
					data: { records: { totalCount: 1, nodes: [{ id: 1, time: 123 }] } },
				},
			},
		])
	})

	test('echoes requested websocket subprotocol on upgrade', () => {
		const { handlers } = createHandlers(() => ({ data: {} }))
		const context = {
			request: new Request('http://localhost/', {
				headers: { 'sec-websocket-protocol': 'graphql-ws' },
			}),
			set: { headers: {} as Record<string, string> },
		}

		handlers.upgrade(context)

		expect(context.set.headers['sec-websocket-protocol']).toBe('graphql-ws')
	})

	test('invalid query sends protocol error', async () => {
		const { handlers } = createHandlers(() => ({ data: {} }))
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			JSON.stringify({
				id: '1',
				type: 'subscribe',
				payload: { query: 'query { records { totalCount } }' },
			}),
		)
		await Bun.sleep(1)

		expect(socket.sent).toEqual([
			{
				id: '1',
				type: 'error',
				payload: [{ message: 'Live query websocket only accepts subscription operations' }],
			},
		])
	})

	test('execution failure sends operation scoped error', async () => {
		const { handlers } = createHandlers(() => {
			throw new Error('GraphQL execution failed')
		})
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			JSON.stringify({
				id: '1',
				type: 'subscribe',
				payload: {
					query: 'subscription { records(first: 1) { totalCount nodes { id } } }',
				},
			}),
		)
		await Bun.sleep(1)

		expect(socket.sent).toEqual([
			{
				id: '1',
				type: 'error',
				payload: [{ message: 'GraphQL execution failed' }],
			},
		])
	})

	test('invalidation reruns operations and only emits changed results', async () => {
		let result = { data: { records: { totalCount: 1, nodes: [{ id: 1 }] } } }
		let executions = 0
		const { handlers, invalidate } = createHandlers(() => {
			executions += 1
			return result
		})
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			JSON.stringify({
				id: '1',
				type: 'subscribe',
				payload: {
					query: 'subscription { records(first: 1) { totalCount nodes { id } } }',
				},
			}),
		)
		await Bun.sleep(1)
		socket.sent.length = 0

		invalidate()
		await Bun.sleep(5)
		expect(socket.sent).toEqual([])

		result = { data: { records: { totalCount: 2, nodes: [{ id: 2 }] } } }
		invalidate()
		await Bun.sleep(5)

		expect(executions).toBe(3)
		expect(socket.sent).toEqual([
			{
				id: '1',
				type: 'next',
				payload: { data: { records: { totalCount: 2, nodes: [{ id: 2 }] } } },
			},
		])
	})

	test('one invalidation execution fans changed result to duplicate subscribers', async () => {
		let result = { data: { records: { totalCount: 1 } } }
		let executions = 0
		const { handlers, invalidate } = createHandlers(() => {
			executions += 1
			return result
		})
		const first = createWebSocket()
		const second = createWebSocket()
		const query = 'subscription Shared { records(first: 1) { totalCount } }'

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('first', query))
		handlers.message(second.ws, subscribe('second', query))
		await Bun.sleep(2)
		first.sent.length = 0
		second.sent.length = 0

		result = { data: { records: { totalCount: 2 } } }
		invalidate()
		await Bun.sleep(5)

		expect(executions).toBe(2)
		expect(first.sent).toEqual([{ id: 'first', type: 'next', payload: result }])
		expect(second.sent).toEqual([{ id: 'second', type: 'next', payload: result }])
	})

	test('detaches subscribers independently and frees shared state after the last close', async () => {
		const sharedCounts: number[] = []
		let executions = 0
		const { handlers, invalidate } = createHandlers(
			() => {
				executions += 1
				return { data: { records: { totalCount: executions } } }
			},
			undefined,
			10,
			undefined,
			{ onActiveSharedOperationsChange: (count) => sharedCounts.push(count) },
		)
		const first = createWebSocket()
		const second = createWebSocket()
		const query = 'subscription Shared { records(first: 1) { totalCount } }'

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('first', query))
		handlers.message(second.ws, subscribe('second', query))
		await Bun.sleep(2)
		first.sent.length = 0
		second.sent.length = 0

		handlers.message(first.ws, JSON.stringify({ id: 'first', type: 'complete' }))
		invalidate()
		await Bun.sleep(5)

		expect(first.sent).toEqual([])
		expect(second.sent).toHaveLength(1)
		handlers.close(second.ws)
		expect(sharedCounts).toEqual([1, 0])
	})

	test('replaces an operation ID without leaving its previous shared group active', async () => {
		let executions = 0
		const activeOperationCounts: number[] = []
		const { handlers, invalidate } = createHandlers(
			(body) => {
				executions += 1
				return { data: { records: { totalCount: getFirstVariable(body.variables) } } }
			},
			undefined,
			10,
			(count) => activeOperationCounts.push(count),
		)
		const socket = createWebSocket()
		const query = 'subscription Shared($first: Int) { records(first: $first) { totalCount } }'

		handlers.open(socket.ws)
		handlers.message(socket.ws, subscribe('same-id', query, { first: 1 }))
		await Bun.sleep(2)
		handlers.message(socket.ws, subscribe('same-id', query, { first: 2 }))
		await Bun.sleep(2)
		socket.sent.length = 0

		invalidate()
		await Bun.sleep(5)

		expect(executions).toBe(3)
		expect(activeOperationCounts).toEqual([1, 0, 1])
		expect(socket.sent).toEqual([])
	})

	test('coalesces invalidations received during a running execution', async () => {
		let executions = 0
		const pendingExecutions: Array<(value: unknown) => void> = []
		const { handlers, invalidate } = createHandlers(() => {
			executions += 1
			if (executions === 1) {
				return { data: { records: { totalCount: 1 } } }
			}

			return new Promise((resolve) => pendingExecutions.push(resolve))
		})
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			subscribe('1', 'subscription { records(first: 1) { totalCount } }'),
		)
		await Bun.sleep(2)

		invalidate()
		await Bun.sleep(4)
		expect(executions).toBe(2)

		invalidate()
		await Bun.sleep(3)
		invalidate()
		await Bun.sleep(3)
		expect(executions).toBe(2)

		pendingExecutions.shift()?.({ data: { records: { totalCount: 2 } } })
		await Bun.sleep(2)
		expect(executions).toBe(3)
		pendingExecutions.shift()?.({ data: { records: { totalCount: 3 } } })
		await Bun.sleep(2)

		expect(executions).toBe(3)
	})

	test('bounds concurrent unique executions', async () => {
		let running = 0
		let maximumRunning = 0
		const releases: Array<() => void> = []
		const runningCounts: number[] = []
		const queueDepths: number[] = []
		const { handlers } = createHandlers(
			async () => {
				running += 1
				maximumRunning = Math.max(maximumRunning, running)
				await new Promise<void>((resolve) => releases.push(resolve))
				running -= 1
				return { data: { records: { totalCount: 1 } } }
			},
			undefined,
			10,
			undefined,
			{
				maxConcurrentExecutions: 2,
				onQueueDepthChange: (count) => queueDepths.push(count),
				onRunningExecutionsChange: (count) => runningCounts.push(count),
			},
		)
		const query = 'subscription Shared($first: Int) { records(first: $first) { totalCount } }'
		const sockets = [createWebSocket(), createWebSocket(), createWebSocket()]

		for (const [index, socket] of sockets.entries()) {
			handlers.open(socket.ws)
			handlers.message(socket.ws, subscribe(String(index), query, { first: index + 1 }))
		}
		await Bun.sleep(2)

		expect(maximumRunning).toBe(2)
		expect(releases).toHaveLength(2)
		releases.shift()?.()
		await Bun.sleep(2)
		expect(releases).toHaveLength(2)
		releases.shift()?.()
		releases.shift()?.()
		await Bun.sleep(2)

		expect(maximumRunning).toBe(2)
		expect(queueDepths).toContain(1)
		expect(queueDepths.at(-1)).toBe(0)
		expect(runningCounts).toContain(2)
		expect(runningCounts.at(-1)).toBe(0)
	})

	test('prioritizes queued initial execution over queued invalidation rerun', async () => {
		const executionOrder: number[] = []
		const blockedRerun = Promise.withResolvers<unknown>()
		let blockFirstRerun = false
		const { handlers, invalidate } = createHandlers(
			(body) => {
				const first = getFirstVariable(body.variables)
				executionOrder.push(first)
				if (blockFirstRerun && first === 1) {
					return blockedRerun.promise
				}

				return { data: { records: { totalCount: first } } }
			},
			undefined,
			10,
			undefined,
			{ maxConcurrentExecutions: 1 },
		)
		const first = createWebSocket()
		const second = createWebSocket()
		const initial = createWebSocket()
		const query = 'subscription Shared($first: Int) { records(first: $first) { totalCount } }'

		for (const socket of [first, second, initial]) handlers.open(socket.ws)
		handlers.message(first.ws, subscribe('1', query, { first: 1 }))
		await Bun.sleep(2)
		handlers.message(second.ws, subscribe('2', query, { first: 2 }))
		await Bun.sleep(2)

		blockFirstRerun = true
		invalidate()
		await Bun.sleep(3)
		handlers.message(initial.ws, subscribe('3', query, { first: 3 }))
		await Bun.sleep(2)
		expect(executionOrder).toEqual([1, 2, 1])

		blockFirstRerun = false
		blockedRerun.resolve({ data: { records: { totalCount: 1 } } })
		await Bun.sleep(5)

		expect(executionOrder).toEqual([1, 2, 1, 3, 2])
	})

	test('complete and close remove active operations', async () => {
		const activeStates: boolean[] = []
		const activeOperationCounts: number[] = []
		const { handlers, invalidate } = createHandlers(
			() => ({ data: { records: { totalCount: 1, nodes: [] } } }),
			(active) => activeStates.push(active),
			10,
			(count) => activeOperationCounts.push(count),
		)
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			JSON.stringify({
				id: '1',
				type: 'subscribe',
				payload: {
					query: 'subscription { records(first: 1) { totalCount nodes { id } } }',
				},
			}),
		)
		await Bun.sleep(1)
		handlers.message(socket.ws, JSON.stringify({ id: '1', type: 'complete' }))
		socket.sent.length = 0
		invalidate()
		await Bun.sleep(5)

		expect(activeStates).toEqual([true, false])
		expect(activeOperationCounts).toEqual([1, 0])
		expect(socket.sent).toEqual([])
		handlers.close(socket.ws)
	})

	test('rejects excess live operations with protocol error', async () => {
		const { handlers } = createHandlers(() => ({ data: {} }), undefined, 1)
		const socket = createWebSocket()

		handlers.open(socket.ws)
		for (const id of ['1', '2']) {
			handlers.message(
				socket.ws,
				JSON.stringify({
					id,
					type: 'subscribe',
					payload: {
						query: 'subscription { records(first: 1) { totalCount } }',
					},
				}),
			)
			await Bun.sleep(1)
		}

		expect(socket.sent.at(-1)).toEqual({
			id: '2',
			type: 'error',
			payload: [{ message: 'Too many live query operations' }],
		})
	})

	test('reserves global capacity while async subscription validation is pending', async () => {
		let executions = 0
		const pendingCost = Promise.withResolvers<{ kind: 'accepted'; cost: number }>()
		const rejections: string[] = []
		const { handlers } = createHandlers(
			() => {
				executions += 1
				return { data: {} }
			},
			undefined,
			1,
			undefined,
			{
				evaluateQueryCost: () => pendingCost.promise,
				onRejected: (reason) => rejections.push(reason),
			},
		)
		const first = createWebSocket()
		const second = createWebSocket()
		const query = 'subscription { records(first: 1) { totalCount } }'

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('1', query))
		await Bun.sleep(1)
		handlers.message(second.ws, subscribe('2', query))
		await Bun.sleep(1)

		expect(second.sent.at(-1)).toEqual({
			id: '2',
			type: 'error',
			payload: [{ message: 'Too many live query operations' }],
		})
		pendingCost.resolve({ kind: 'accepted', cost: 1 })
		await Bun.sleep(3)

		expect(executions).toBe(1)
		expect(rejections).toEqual(['global_limit'])
	})

	test('rejects excess operations per connection without consuming global capacity', async () => {
		const rejections: string[] = []
		const { handlers } = createHandlers(() => ({ data: {} }), undefined, 10, undefined, {
			maxOperationsPerConnection: 1,
			onRejected: (reason) => rejections.push(reason),
		})
		const first = createWebSocket()
		const second = createWebSocket()
		const query = 'subscription { records(first: 1) { totalCount } }'

		handlers.open(first.ws)
		handlers.open(second.ws)
		handlers.message(first.ws, subscribe('1', query))
		await Bun.sleep(1)
		handlers.message(first.ws, subscribe('2', query))
		handlers.message(second.ws, subscribe('3', query))
		await Bun.sleep(2)

		expect(first.sent.at(-1)).toEqual({
			id: '2',
			type: 'error',
			payload: [{ message: 'Too many live query operations on this connection' }],
		})
		expect(second.sent.at(-1)?.type).toBe('next')
		expect(rejections).toEqual(['connection_limit'])
	})

	test('rejects over-cost and introspection subscriptions before execution', async () => {
		let executions = 0
		const rejections: string[] = []
		const { handlers } = createHandlers(
			() => {
				executions += 1
				return { data: {} }
			},
			undefined,
			10,
			undefined,
			{
				evaluateQueryCost: createQueryCostEvaluator({ maxCost: 1 }),
				onRejected: (reason) => rejections.push(reason),
			},
		)
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(
			socket.ws,
			subscribe('cost', 'subscription { records(first: 100) { nodes { id } } }'),
		)
		await Bun.sleep(2)
		handlers.message(
			socket.ws,
			subscribe('schema', 'subscription { __schema { queryType { name } } }'),
		)
		await Bun.sleep(2)

		expect(executions).toBe(0)
		expect(socket.sent[0]?.payload).toEqual([
			{ message: expect.stringContaining('Query Cost Exceeded') },
		])
		expect(socket.sent[1]).toEqual({
			id: 'schema',
			type: 'error',
			payload: [{ message: 'Live query websocket does not accept introspection operations' }],
		})
		expect(rejections).toEqual(['cost', 'introspection'])
	})

	test('malformed JSON closes websocket without throwing', () => {
		const { handlers } = createHandlers(() => ({ data: {} }))
		const socket = createWebSocket()

		handlers.open(socket.ws)
		handlers.message(socket.ws, '{')

		expect(socket.closeCode).toBe(4400)
		expect(socket.closeReason).toBe('Malformed websocket message')
	})
})
