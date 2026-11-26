import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'
import {
	createElysiaRequestLoggingPlugin,
	emitTelemetryLog,
	getHttpErrorStatus,
	getMeter,
	recordSpanFailure,
	SpanKind,
	withActiveSpan,
	withExtractedTraceContext,
} from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import { websocket } from 'elysia/websocket'
import { createPostGraphileCors } from './middleware/cors'
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

let requestDuration: ReturnType<ReturnType<typeof getMeter>['createHistogram']> | undefined

function telemetryRoute(path: string) {
	if (path.startsWith('/ruru-static/')) return '/ruru-static/*'
	switch (path) {
		case '/':
		case '/graphql':
		case '/graphiql':
		case '/healthz':
		case '/readyz':
			return path
		default:
			return 'unmatched'
	}
}

function trackRequest<Args extends unknown[]>(
	next: (request: Request, ...args: Args) => Response | Promise<Response>,
) {
	return async (request: Request, ...args: Args) => {
		const url = new URL(request.url)
		const route = telemetryRoute(url.pathname)
		const method = request.method
		const attributes = { 'http.request.method': method, 'http.route': route }
		const started = performance.now()
		let status: number | undefined
		function recordFailure() {
			if (status !== undefined && status >= 500) {
				emitTelemetryLog('error', 'HTTP request failed', {
					...attributes,
					'http.response.status_code': status,
				})
			}
		}
		try {
			if (route === '/healthz' || route === '/readyz') {
				const response = await next(request, ...args)
				status = response.status
				recordFailure()
				return response
			}

			return await withExtractedTraceContext(request.headers, () =>
				withActiveSpan(
					`${method} ${route}`,
					{ kind: SpanKind.SERVER, attributes },
					async (span) => {
						try {
							const response = await next(request, ...args)
							status = response?.status ?? 101
							span.setAttribute('http.response.status_code', status)
							if (status >= 500) recordSpanFailure(span, 'http.response')
							recordFailure()
							return response
						} catch (error) {
							status = getHttpErrorStatus(error) ?? 500
							span.setAttribute('http.response.status_code', status)
							recordFailure()
							throw error
						}
					},
				),
			)
		} finally {
			requestDuration ??= getMeter('zeepcentraal-http-server').createHistogram(
				'http.server.request.duration',
				{
					unit: 's',
					advice: {
						explicitBucketBoundaries: [
							0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5,
							10, 30, 60, 120, 300, 600, 900, 1800,
						],
					},
				},
			)
			requestDuration.record((performance.now() - started) / 1_000, {
				...attributes,
				'url.scheme': url.protocol.slice(0, -1),
				'http.response.status_code': status,
				...(status !== undefined && status >= 500 ? { 'error.type': String(status) } : {}),
			})
		}
	}
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

const withLogging = createElysiaRequestLoggingPlugin({
	enabled: () => postgraphileConfig.requestLogging,
})

export function buildPostGraphileServer(
	handler = createPostGraphileHandler(),
	providedReadiness?: ReadinessService,
) {
	const runtime = createPostGraphileRuntime(handler)
	const readiness =
		providedReadiness ??
		createReadinessService(runtime.readinessProbe, postgraphileConfig.readiness)
	const httpIdleTimeout = Math.ceil(postgraphileConfig.databaseTimeouts.statementMs / 1000) + 5

	return new Elysia({
		precompile: true,
		serve: {
			development: postgraphileConfig.nodeEnv !== 'production',
			idleTimeout: httpIdleTimeout > 255 ? 0 : httpIdleTimeout,
			maxRequestBodySize: postgraphileConfig.maxRequestBodySize,
		},
	})
		.use(withLogging)
		.use(createPostGraphileCors(postgraphileConfig.corsCredentialOrigins))
		.use(websocket())
		.wrap(trackRequest)
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
		.onStop(async () => {
			await readiness.dispose()
			await runtime.stop()
		})
}
