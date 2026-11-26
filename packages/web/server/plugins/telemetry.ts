import {
	emitTelemetryLog,
	getHttpErrorStatus,
	recordSpanFailure,
	SpanKind,
	withActiveSpan,
	withExtractedTraceContext,
} from '@zeepkist/telemetry'
import { getRequestHeaders, getRequestURL } from 'h3'
import { defineNitroPlugin } from 'nitropack/runtime'
import { shouldRecordWebError } from '../../runtime/telemetryPolicy'
import { resolveTelemetryRoute } from '../utils/telemetryRoute'

const STATIC_PATH =
	/(?:^\/_nuxt\/|\.(?:avif|css|gif|ico|jpe?g|js|map|png|svg|webp|woff2?)(?:\?|$))/i

export default defineNitroPlugin((nitroApp) => {
	const handler = nitroApp.h3App.handler
	nitroApp.h3App.handler = async (event) => {
		const url = getRequestURL(event)
		if (url.pathname === '/healthz' || url.pathname === '/readyz') {
			const result = await handler(event)
			if (event.node.res.statusCode >= 500) {
				emitTelemetryLog('error', 'HTTP probe failed', {
					'http.route': url.pathname,
					'http.response.status_code': event.node.res.statusCode,
				})
			}
			return result
		}
		if (STATIC_PATH.test(url.pathname)) return handler(event)
		const method = event.method
		return withExtractedTraceContext(getRequestHeaders(event), () =>
			withActiveSpan(
				`${method} unmatched`,
				{
					kind: SpanKind.SERVER,
					shouldRecordError: shouldRecordWebError,
					attributes: {
						'http.request.method': method,
						'server.address': url.hostname,
						'web.render.type': url.pathname.startsWith('/api/') ? 'api' : 'ssr',
					},
				},
				async (span) => {
					let status: number | undefined
					try {
						const result = await handler(event)
						status = event.node.res.statusCode
						span.setAttribute('http.response.status_code', status)
						if (status >= 500) recordSpanFailure(span, 'http.response')
						return result
					} catch (error) {
						status = getHttpErrorStatus(error) ?? 500
						span.setAttribute('http.response.status_code', status)
						throw error
					} finally {
						const route = resolveTelemetryRoute(event.context.matchedRoute)
						span.updateName(`${method} ${route}`)
						span.setAttribute('http.route', route)
						if (status !== undefined && status >= 500) {
							emitTelemetryLog('error', 'HTTP request failed', {
								'http.request.method': method,
								'http.route': route,
								'http.response.status_code': status,
							})
						}
					}
				},
			),
		)
	}
})
