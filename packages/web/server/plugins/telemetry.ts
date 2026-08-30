import { SpanKind, withActiveSpan, withExtractedTraceContext } from '@zeepkist/telemetry'
import { resolveTelemetryRoute } from '../utils/telemetryRoute'

const STATIC_PATH =
	/(?:^\/_nuxt\/|\.(?:avif|css|gif|ico|jpe?g|js|map|png|svg|webp|woff2?)(?:\?|$))/i

export default defineNitroPlugin((nitroApp) => {
	const handler = nitroApp.h3App.handler
	nitroApp.h3App.handler = async (event) => {
		const url = getRequestURL(event)
		if (url.pathname === '/healthz' || STATIC_PATH.test(url.pathname)) return handler(event)
		const method = event.method
		return withExtractedTraceContext(getRequestHeaders(event), () =>
			withActiveSpan(
				`${method} ${url.pathname}`,
				{
					kind: SpanKind.SERVER,
					attributes: {
						'http.request.method': method,
						'url.path': url.pathname,
						'server.address': url.hostname,
						'web.render.type': url.pathname.startsWith('/api/') ? 'api' : 'ssr',
					},
				},
				async (span) => {
					const result = await handler(event)
					const status = event.node.res.statusCode
					const route = resolveTelemetryRoute(event.context.matchedRoute, url.pathname)
					span.updateName(`${method} ${route}`)
					span.setAttributes({
						'http.response.status_code': status,
						'http.route': route,
					})
					span.addEvent('web.request.completed', {
						'http.response.status_code': status,
						'web.render.type': url.pathname.startsWith('/api/') ? 'api' : 'ssr',
					})
					if (status >= 500) {
						span.addEvent('error', {
							'error.type': 'http.response',
							'http.response.status_code': status,
						})
						span.setErrorStatus(`HTTP ${status}`)
					}
					return result
				},
			),
		)
	}
})
