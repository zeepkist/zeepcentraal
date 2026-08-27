import cors from '@elysiajs/cors'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import logixlysia from 'logixlysia'
import { serveGraphiql } from './middleware/serveGraphiql'
import { createPostGraphileHandler } from './postgraphileOptions'
import { createPostGraphileRuntime } from './postgraphileRuntime'
import { createReadinessService, type ReadinessService } from './readiness'

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

async function readinessResponse(readiness: ReadinessService, head = false) {
	const result = await readiness.check()
	return new Response(head ? null : result.ok ? 'OK' : 'Not Ready', {
		status: result.ok ? 200 : 503,
		headers: {
			'Cache-Control': 'no-store',
			...(result.ok ? {} : { 'Retry-After': '1' }),
		},
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

export function buildPostGraphileServer(
	handler = createPostGraphileHandler(),
	providedReadiness?: ReadinessService,
) {
	const runtime = createPostGraphileRuntime(handler)
	const readiness =
		providedReadiness ??
		createReadinessService(runtime.readinessProbe, postgraphileConfig.readiness)

	return new Elysia({
		aot: true,
		precompile: true,
		serve: {
			development: postgraphileConfig.nodeEnv !== 'production',
			maxRequestBodySize: postgraphileConfig.maxRequestBodySize,
		},
	})
		.use(withLogging)
		.use(cors())
		.use(createWithTelemetry())
		.get('/healthz', () => 'OK')
		.head('/healthz', () => 'OK')
		.get('/readyz', () => readinessResponse(readiness))
		.head('/readyz', () => readinessResponse(readiness, true))
		.ws('/', {
			...runtime.liveQueryWebSocket,
			maxPayloadLength: postgraphileConfig.liveQueries.maxMessageBytes,
		})
		.get('/', ({ request }) => serveGraphiql(request))
		.get('/graphiql', ({ request }) => redirectToRoot(request))
		.get('/graphql', ({ request }) => redirectToRoot(request))
		.all('/ruru-static/*', ({ request }) => runtime.serveRuruStatic(request))
		.post('/', runtime.graphqlRoute)
		.options('/', runtime.graphqlRoute)
		.onStop(async () => {
			await readiness.dispose()
			await runtime.stop()
		})
}
