import { SpanKind } from '@opentelemetry/api'
import { getMeter, injectTraceHeaders, withActiveSpan } from './span'

const httpDuration = getMeter('zeepcentraal-http').createHistogram('http.client.request.duration', {
	description: 'Outbound HTTP request duration',
	unit: 's',
})

const REDACTED_QUERY_NAMES =
	/^(?:access[_-]?token|api[_-]?key|auth|authorization|code|key|password|secret|signature|token)$/i

export function sanitizeUrl(input: string | URL | Request): URL {
	const source = input instanceof Request ? input.url : input
	const url = new URL(source)
	for (const name of url.searchParams.keys()) {
		url.searchParams.set(name, REDACTED_QUERY_NAMES.test(name) ? '[redacted]' : '*')
	}
	url.username = ''
	url.password = ''
	return url
}

export type TracedFetchOptions = {
	fetch?: typeof fetch
	operationName?: string
	attributes?: Record<string, string | number | boolean>
}

export async function tracedFetch(
	input: string | URL | Request,
	init: RequestInit = {},
	options: TracedFetchOptions = {},
): Promise<Response> {
	const request = input instanceof Request ? input : undefined
	const url = sanitizeUrl(input)
	const method = (init.method ?? request?.method ?? 'GET').toUpperCase()
	const started = performance.now()
	let responseStatus: number | undefined

	try {
		return await withActiveSpan(
			options.operationName ?? `${method} ${url.host}`,
			{
				kind: SpanKind.CLIENT,
				attributes: {
					'http.request.method': method,
					'server.address': url.hostname,
					...(url.port ? { 'server.port': Number(url.port) } : {}),
					'url.full': url.toString(),
					'url.scheme': url.protocol.slice(0, -1),
					...options.attributes,
				},
			},
			async (span) => {
				const headers = injectTraceHeaders(init.headers ?? request?.headers)
				const response = await (options.fetch ?? fetch)(input, { ...init, headers })
				responseStatus = response.status
				span.setAttribute('http.response.status_code', response.status)
				span.addEvent('http.response', {
					'http.response.status_code': response.status,
					'http.response.body.size': Number(response.headers.get('content-length') ?? 0),
				})
				if (!response.ok) {
					span.addEvent('error', {
						'error.type': 'http.response',
						'http.response.status_code': response.status,
					})
					span.setErrorStatus(`HTTP ${response.status}`)
				}
				return response
			},
		)
	} finally {
		httpDuration.record((performance.now() - started) / 1_000, {
			'http.request.method': method,
			...(responseStatus !== undefined
				? { 'http.response.status_code': responseStatus }
				: {}),
			'server.address': url.hostname,
		})
	}
}
