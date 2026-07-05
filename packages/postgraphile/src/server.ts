import cors from '@elysiajs/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import logixlysia from 'logixlysia'
import { elysiaGrafserv } from './elysiaGrafserv'
import { createEventStreamHandler, createGraphqlHttpHandler } from './graphqlHttp'
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
	const eventStreamRoute = createEventStreamHandler(server)
	const websocketHandlers = server.createWebSocketHandlers()

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
		.ws('/', websocketHandlers)
		.get('/stream', eventStreamRoute)
		.post('/', graphqlRoute)
		.options('/', graphqlRoute)
}
