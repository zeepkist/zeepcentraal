import { describe, expect, test } from 'bun:test'
import { buildSchema } from 'postgraphile/graphql'
import { createLiveQueryWebSocketHandlers } from './liveQueryWebSocket'

type SentMessage = {
	id?: string
	type: string
	payload?: unknown
}

function createWebSocket(protocol = 'graphql-transport-ws') {
	const sent: SentMessage[] = []
	let closeCode: number | undefined
	let closeReason: string | undefined

	return {
		ws: {
			data: {
				request: new Request('http://localhost/', {
					headers: {
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

function createHandlers(
	execute: (
		body: { query: string; variables?: unknown; operationName?: string },
		request: Request,
	) => unknown,
	onActiveChange?: (active: boolean) => void,
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
		maxOperations: 10,
		onActiveChange,
		async execute(_request, body) {
			return execute(body, _request)
		},
	})
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

	test('complete and close remove active operations', async () => {
		const activeStates: boolean[] = []
		const { handlers, invalidate } = createHandlers(
			() => ({ data: { records: { totalCount: 1, nodes: [] } } }),
			(active) => activeStates.push(active),
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
		expect(socket.sent).toEqual([])
		handlers.close(socket.ws)
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
