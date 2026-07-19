import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import type { GraphQLSchema } from 'postgraphile/graphql'
import { type ElysiaGrafserv, elysiaGrafserv } from './elysiaGrafserv'
import { createGraphqlHttpHandler } from './graphqlHttp'
import { readGraphqlJsonResponse } from './graphqlResponse'
import { createLiveQueryInvalidationPoller } from './liveQueryInvalidationPoller'
import { createLiveQueryWebSocketHandlers } from './liveQueryWebSocket'
import { serveGraphiql } from './middleware/serveGraphiql'

type PostGraphileRuntimeConfig = typeof postgraphileConfig

type PostGraphileHandler = {
	createServ(adapter: typeof elysiaGrafserv): ElysiaGrafserv
	getSchema(): GraphQLSchema | PromiseLike<GraphQLSchema>
}

export function createPostGraphileRuntime(
	handler: PostGraphileHandler,
	config: PostGraphileRuntimeConfig = postgraphileConfig,
) {
	const server = handler.createServ(elysiaGrafserv)
	const poller = createLiveQueryInvalidationPoller({
		...config.liveQueries,
		databaseUrl: config.databaseUrl,
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
