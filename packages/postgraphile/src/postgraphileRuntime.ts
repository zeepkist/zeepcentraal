import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type { GraphQLSchema } from 'postgraphile/graphql'
import { type ElysiaGrafserv, elysiaGrafserv } from './elysiaGrafserv'
import { createGraphqlHttpHandler } from './graphqlHttp'
import { readGraphqlJsonResponse } from './graphqlResponse'
import { createLiveQueryInvalidationPoller } from './liveQueryInvalidationPoller'
import { createLiveQueryWebSocketHandlers } from './liveQueryWebSocket'
import { serveGraphiql } from './middleware/serveGraphiql'
import type { ReadinessProbe } from './readiness'

type PostGraphileRuntimeConfig = typeof postgraphileConfig

type PostGraphileHandler = {
	createServ(adapter: typeof elysiaGrafserv): ElysiaGrafserv
	getSchema(): GraphQLSchema | PromiseLike<GraphQLSchema>
}

const readinessBody = {
	operationName: 'ZC_Readiness',
	query: 'query ZC_Readiness { versions(first: 1) { nodes { id } } }',
}

function isGraphqlReadinessPayload(value: unknown): value is { data: unknown; errors?: unknown[] } {
	return typeof value === 'object' && value !== null && 'data' in value
}

export function createRuntimeReadinessProbe(server: ElysiaGrafserv): ReadinessProbe {
	return {
		start() {
			const controller = new AbortController()
			const request = new Request('http://localhost/', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				signal: controller.signal,
			})
			const promise = (async () => {
				const response = await server.handleGraphQLRequest(request, readinessBody)
				if (!response?.ok) throw new Error('runtime readiness query failed')

				const payload = await readGraphqlJsonResponse(response)
				if (
					!isGraphqlReadinessPayload(payload) ||
					(Array.isArray(payload.errors) && payload.errors.length > 0)
				) {
					throw new Error('runtime readiness query returned GraphQL errors')
				}
			})()

			return {
				promise,
				cancel() {
					controller.abort()
				},
			}
		},
		async close() {},
	}
}

export function createPostGraphileRuntime(
	handler: PostGraphileHandler,
	config: PostGraphileRuntimeConfig = postgraphileConfig,
) {
	const server = handler.createServ(elysiaGrafserv)
	const poller = createLiveQueryInvalidationPoller({
		...config.liveQueries,
		databaseUrl: config.databaseUrl,
		databaseTimeouts: config.databaseTimeouts,
	})
	const liveQueryWebSocket = createLiveQueryWebSocketHandlers({
		schema: Promise.resolve(handler.getSchema()),
		debounceMs: config.liveQueries.debounceMs,
		maxOperations: config.liveQueries.maxOperations,
		onActiveChange(active) {
			if (active) {
				poller.start(liveQueryWebSocket.invalidate)
			} else {
				poller.stop()
			}
		},
		async execute(request, body) {
			return readGraphqlJsonResponse(await server.handleGraphQLRequest(request, body))
		},
	})

	return {
		graphqlRoute: createGraphqlHttpHandler(server, config),
		readinessProbe: createRuntimeReadinessProbe(server),
		liveQueryWebSocket: liveQueryWebSocket.handlers,
		async serveRuruStatic(request: Request) {
			return (
				(await server.handleGraphiQLStaticRequest(request)) ??
				(await serveGraphiql(request)) ??
				new Response('Not Found', { status: 404 })
			)
		},
		async stop() {
			await poller.dispose()
		},
	}
}
