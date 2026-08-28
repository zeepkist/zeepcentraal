import { describe, expect, test } from 'bun:test'
import { buildSchema } from 'postgraphile/graphql'
import type { ReadinessService } from './readiness'
import {
	buildPostGraphileServer,
	createPostGraphilePgServiceOptions,
	createPostGraphilePreset,
	createPostGraphileV4Options,
} from './server'

const postgraphileRuntimeConfig = {
	databaseUrl: 'postgres://zeepcentraal_graphql:secret@database:5432/zeepkist',
	superuserDatabaseUrl: 'postgres://postgres:secret@database:5432/zeepkist',
	allowExplain: false,
	nodeEnv: 'production',
	databaseTimeouts: {
		connectMs: 5000,
		statementMs: 15000,
		lockMs: 3000,
		idleTransactionMs: 30000,
	},
	databasePoolMax: 6,
	cacheMaxEntries: 128,
	operationPlansPerOperation: 8,
	liveQueries: { enabled: true },
}

function createReadiness(ok = true): ReadinessService {
	return {
		async check() {
			return { ok }
		},
		async dispose() {},
	}
}

function createApp(readiness = createReadiness()) {
	const server = {
		async handleGraphQLRequest() {
			return Response.json(
				{ data: { ok: true } },
				{ headers: { 'X-GraphQL-Event-Stream': '/graphql/stream' } },
			)
		},
		async handleGraphiQLStaticRequest() {
			return null
		},
	}
	const handler = {
		createServ() {
			return server
		},
		getSchema() {
			return buildSchema(`
				type Query {
					ok: Boolean
				}

				type Subscription {
					ok: Boolean
				}
			`)
		},
	}

	return buildPostGraphileServer(handler as never, readiness)
}

describe('buildPostGraphileServer', () => {
	test('respects database grants and never configures a production superuser pool', () => {
		expect(createPostGraphileV4Options(postgraphileRuntimeConfig).ignoreRBAC).toBe(false)
		expect(createPostGraphilePgServiceOptions(postgraphileRuntimeConfig)).toEqual({
			connectionString: postgraphileRuntimeConfig.databaseUrl,
			poolConfig: {
				application_name: 'zeepcentraal-postgraphile',
				max: 6,
				connectionTimeoutMillis: 5000,
				statement_timeout: 15000,
				lock_timeout: 3000,
				idle_in_transaction_session_timeout: 30000,
			},
			schemas: ['public'],
		})
	})

	test('uses a distinct superuser connection only for development schema watching', () => {
		expect(
			createPostGraphilePgServiceOptions({
				...postgraphileRuntimeConfig,
				nodeEnv: 'development',
			}),
		).toEqual({
			connectionString: postgraphileRuntimeConfig.databaseUrl,
			poolConfig: {
				application_name: 'zeepcentraal-postgraphile',
				max: 6,
				connectionTimeoutMillis: 5000,
				statement_timeout: 15000,
				lock_timeout: 3000,
				idle_in_transaction_session_timeout: 30000,
			},
			superuserConnectionString: postgraphileRuntimeConfig.superuserDatabaseUrl,
			schemas: ['public'],
		})
	})

	test('serves database-backed readiness separately from liveness', async () => {
		const ready = await createApp(createReadiness(true)).handle(
			new Request('http://localhost/readyz'),
		)
		const unavailableApp = createApp(createReadiness(false))
		const unavailable = await unavailableApp.handle(new Request('http://localhost/readyz'))
		const liveness = await unavailableApp.handle(new Request('http://localhost/healthz'))

		expect(ready.status).toBe(200)
		expect(await ready.text()).toBe('OK')
		expect(ready.headers.get('cache-control')).toBe('no-store')
		expect(unavailable.status).toBe(503)
		expect(await unavailable.text()).toBe('Not Ready')
		expect(unavailable.headers.get('retry-after')).toBe('1')
		expect(liveness.status).toBe(200)
		expect(await liveness.text()).toBe('OK')
	})

	test('configures Grafserv for root graphql route and websocket subscriptions', () => {
		const preset = createPostGraphilePreset()

		expect(preset.grafserv?.graphqlPath).toBe('/')
		expect(preset.grafserv?.eventStreamPath).toBeUndefined()
		expect(preset.grafserv?.websockets).toBe(true)
		expect(preset.grafserv?.parseAndValidateCacheSize).toBe(128)
	})

	test('negotiates graphql-transport-ws at the root listener', async () => {
		const app = createApp().listen({ hostname: '127.0.0.1', port: 0 })
		const port = app.server?.port
		if (!port) throw new Error('PostGraphile test listener did not bind')

		const socket = new WebSocket(`ws://127.0.0.1:${port}/`, ['graphql-transport-ws'])
		try {
			await new Promise<void>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('WebSocket open timed out')),
					5_000,
				)
				socket.addEventListener('open', () => {
					clearTimeout(timeout)
					resolve()
				})
				socket.addEventListener('error', () => {
					clearTimeout(timeout)
					reject(new Error('WebSocket negotiation failed'))
				})
			})

			socket.send(JSON.stringify({ type: 'connection_init' }))
			const message = await new Promise<string>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('WebSocket ack timed out')),
					5_000,
				)
				socket.addEventListener('message', (event) => {
					clearTimeout(timeout)
					resolve(String(event.data))
				})
			})

			expect(socket.protocol).toBe('graphql-transport-ws')
			expect(JSON.parse(message)).toEqual({ type: 'connection_ack' })
		} finally {
			socket.close()
			await app.stop()
		}
	}, 15_000)

	test('serves health check', async () => {
		const response = await createApp().handle(new Request('http://localhost/healthz'))

		expect(response.status).toBe(200)
		expect(await response.text()).toBe('OK')
	})

	test('serves Ruru at root', async () => {
		const app = createApp()
		const response = await app.handle(new Request('http://localhost/'))
		const secondResponse = await app.handle(new Request('http://localhost/'))
		const html = await response.text()

		expect(response.status).toBe(200)
		expect(response.headers.get('content-type')).toContain('text/html')
		expect(html).toContain('/ruru-static/')
		expect(html).toContain('"subscriptionEndpoint": "ws://localhost/"')
		expect(await secondResponse.text()).toBe(html)
	})

	test('serves Ruru with a secure websocket endpoint for direct HTTPS requests', async () => {
		const response = await createApp().handle(new Request('https://secure-ruru.test/'))

		expect(response.status).toBe(200)
		expect(await response.text()).toContain('"subscriptionEndpoint": "wss://secure-ruru.test/"')
	})

	test('uses a valid first forwarded protocol for Ruru websocket endpoints', async () => {
		const response = await createApp().handle(
			new Request('http://forwarded-ruru.test/', {
				headers: { 'x-forwarded-proto': 'https, http' },
			}),
		)

		expect(response.status).toBe(200)
		expect(await response.text()).toContain(
			'"subscriptionEndpoint": "wss://forwarded-ruru.test/"',
		)
	})

	test('ignores forwarded protocols when the first value is invalid', async () => {
		const response = await createApp().handle(
			new Request('http://invalid-forwarded-ruru.test/', {
				headers: { 'x-forwarded-proto': 'javascript, https' },
			}),
		)

		expect(response.status).toBe(200)
		expect(await response.text()).toContain(
			'"subscriptionEndpoint": "ws://invalid-forwarded-ruru.test/"',
		)
	})

	test('renders Ruru HTML independently for each public protocol', async () => {
		const app = createApp()
		const proxiedHttps = await app.handle(
			new Request('http://cached-ruru.test/', {
				headers: { 'x-forwarded-proto': 'https' },
			}),
		)
		const directHttp = await app.handle(new Request('http://cached-ruru.test/'))

		expect(await proxiedHttps.text()).toContain(
			'"subscriptionEndpoint": "wss://cached-ruru.test/"',
		)
		expect(await directHttp.text()).toContain(
			'"subscriptionEndpoint": "ws://cached-ruru.test/"',
		)
	})

	test('redirects graphiql and graphql to root', async () => {
		const app = createApp()
		const graphiql = await app.handle(new Request('http://localhost/graphiql'))
		const graphql = await app.handle(new Request('http://localhost/graphql'))

		expect(graphiql.status).toBe(302)
		expect(graphiql.headers.get('location')).toBe('http://localhost/')
		expect(graphql.status).toBe(302)
		expect(graphql.headers.get('location')).toBe('http://localhost/')
	})

	test('does not serve PostGraphile event stream route', async () => {
		const response = await createApp().handle(new Request('http://localhost/stream'))

		expect(response.status).toBe(404)
	})

	test('passes valid GraphQL post to Grafserv and sets query cost header', async () => {
		const response = await createApp().handle(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{ level { id } }' }),
			}),
		)

		expect(response.status).toBe(200)
		expect(response.headers.get('X-Query-Cost')).toBeDefined()
		expect(response.headers.get('X-GraphQL-Event-Stream')).toBeNull()
		expect(await response.json()).toEqual({ data: { ok: true } })
	})

	test('rejects invalid GraphQL syntax before PostGraphile', async () => {
		const response = await createApp().handle(
			new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: '{' }),
			}),
		)

		expect(response.status).toBe(400)
		expect(await response.json()).toEqual({
			errors: [
				{
					message: 'Invalid GraphQL Syntax',
					details: expect.any(String),
				},
			],
		})
	})
})
