import cors from '@elysiajs/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import logixlysia from 'logixlysia'
import { serveGraphiql } from './middleware/serveGraphiql'
import { createPostGraphileHandler } from './postgraphileOptions'
import { createPostGraphileRuntime } from './postgraphileRuntime'

export {
	createPostGraphileHandler,
	createPostGraphileOptions,
	createPostGraphilePgServiceOptions,
	createPostGraphilePreset,
	createPostGraphileV4Options,
} from './postgraphileOptions'

function redirectToRoot(request: Request) {
	return Response.redirect(new URL('/', request.url).toString(), 302)
}

function createWithTelemetry() {
	if (process.env.ZEEPCENTRAAL_TEST === '1') {
		return new Elysia()
	}

	return createElysiaTelemetryPlugin({
		packageName: 'postgraphile',
		collectorUrl: postgraphileConfig.otel.collectorUrl,
		nodeEnv: postgraphileConfig.nodeEnv,
		serviceName: postgraphileConfig.otel.serviceName,
		serviceVersion: postgraphileConfig.otel.serviceVersion,
	})
}

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
	const runtime = createPostGraphileRuntime(handler)

	return new Elysia({
		aot: true,
		precompile: true,
		serve: {
			development: postgraphileConfig.nodeEnv !== 'production',
		},
	})
		.use(withLogging)
		.use(cors())
		.use(createWithTelemetry())
		.get('/healthz', () => 'OK')
		.head('/healthz', () => 'OK')
		.ws('/', runtime.liveQueryWebSocket)
		.get('/', ({ request }) => serveGraphiql(request))
		.get('/graphiql', ({ request }) => redirectToRoot(request))
		.get('/graphql', ({ request }) => redirectToRoot(request))
		.all('/ruru-static/*', ({ request }) => runtime.serveRuruStatic(request))
		.post('/', runtime.graphqlRoute)
		.options('/', runtime.graphqlRoute)
		.onStop(runtime.stop)
}
