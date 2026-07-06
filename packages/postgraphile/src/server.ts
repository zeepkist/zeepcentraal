import cors from '@elysiajs/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import logixlysia from 'logixlysia'
import { elysiaGrafserv } from './elysiaGrafserv'
import { createGraphqlHttpHandler } from './graphqlHttp'
import { createLiveQueryInvalidationPoller } from './liveQueryInvalidationPoller'
import { createLiveQueryWebSocketHandlers } from './liveQueryWebSocket'
import { serveGraphiql } from './middleware/serveGraphiql'
import { createPostGraphileHandler } from './postgraphileOptions'

export {
	createPostGraphileHandler,
	createPostGraphileOptions,
	createPostGraphilePreset,
} from './postgraphileOptions'

function redirectToRoot(request: Request) {
	return Response.redirect(new URL('/', request.url).toString(), 302)
}

const withTelemetry = createElysiaTelemetryPlugin({
	packageName: 'postgraphile',
	collectorUrl: postgraphileConfig.otel.collectorUrl,
	nodeEnv: postgraphileConfig.nodeEnv,
	serviceName: postgraphileConfig.otel.serviceName,
	serviceVersion: postgraphileConfig.otel.serviceVersion,
})

const withLogging = postgraphileConfig.requestLogging
	? logixlysia({
			config: {
				showStartupMessage: false,
				disableFileLogging: true,
				requestId: false,
				customLogFormat:
					'{now} {level}\t{method}\t{status} {pathname} {duration} {speed} {ip}',
			},
		})
	: new Elysia()

export function buildPostGraphileServer(handler = createPostGraphileHandler()) {
	const server = handler.createServ(elysiaGrafserv)
	const graphqlRoute = createGraphqlHttpHandler(server)
	const poller = createLiveQueryInvalidationPoller(postgraphileConfig.liveQueries)
	const liveQueryWebSocket = createLiveQueryWebSocketHandlers({
		schema: Promise.resolve(handler.getSchema()),
		debounceMs: postgraphileConfig.liveQueries.debounceMs,
		maxOperations: postgraphileConfig.liveQueries.maxOperations,
		onActiveChange(active) {
			if (active) {
				poller.start(liveQueryWebSocket.invalidate)
			} else {
				poller.stop()
			}
		},
		async execute(request, body) {
			const response = await server.handleGraphQLRequest(request, body)
			if (!response) {
				return { errors: [{ message: 'GraphQL response not found' }] }
			}

			const text = await response.text()
			try {
				return JSON.parse(text) as unknown
			} catch {
				return { errors: [{ message: text || 'GraphQL response was not JSON' }] }
			}
		},
	})

	return new Elysia({
		aot: true,
		precompile: true,
		serve: {
			development: postgraphileConfig.nodeEnv !== 'production',
		},
	})
		.use(withLogging)
		.use(cors())
		.use(withTelemetry)
		.get('/healthz', () => 'OK')
		.head('/healthz', () => 'OK')
		.ws('/', liveQueryWebSocket.handlers)
		.get('/', ({ request }) => serveGraphiql(request))
		.get('/graphiql', ({ request }) => redirectToRoot(request))
		.get('/graphql', ({ request }) => redirectToRoot(request))
		.all('/ruru-static/*', async ({ request }) => {
			return (
				(await server.handleGraphiQLStaticRequest(request)) ??
				(await serveGraphiql(request)) ??
				new Response('Not Found', { status: 404 })
			)
		})
		.post('/', graphqlRoute)
		.options('/', graphqlRoute)
		.onStop(() => poller.stop())
}
