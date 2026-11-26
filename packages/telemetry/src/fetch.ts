import { SpanKind } from '@opentelemetry/api'
import { getMeter, injectTraceHeaders, recordSpanFailure, withActiveSpan } from './span'

let httpDuration: ReturnType<ReturnType<typeof getMeter>['createHistogram']> | undefined

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
	shouldRecordError?: (error: unknown) => boolean
	isErrorResponse?: (response: Response) => boolean
}

export async function tracedFetch(
	input: string | URL | Request,
	init: RequestInit = {},
	options: TracedFetchOptions = {},
): Promise<Response> {
	const request = input instanceof Request ? input : undefined
	const url = new URL(request?.url ?? (input as string | URL))
	const method = (init.method ?? request?.method ?? 'GET').toUpperCase()
	const started = performance.now()
	let responseStatus: number | undefined

	try {
		return await withActiveSpan(
			options.operationName ?? `${method} ${url.hostname}`,
			{
				kind: SpanKind.CLIENT,
				shouldRecordError: options.shouldRecordError,
				attributes: {
					'http.request.method': method,
					'server.address': url.hostname,
					...(url.port ? { 'server.port': Number(url.port) } : {}),
					'http.request.retry_count': 0,
					...options.attributes,
				},
			},
			async (span) => {
				const headers = injectTraceHeaders(init.headers ?? request?.headers)
				const response = await (options.fetch ?? fetch)(input, { ...init, headers })
				responseStatus = response.status
				span.setAttribute('http.response.status_code', response.status)
				if (options.isErrorResponse?.(response) ?? !response.ok) {
					recordSpanFailure(span, 'http.response')
				}
				return response
			},
		)
	} finally {
		httpDuration ??= getMeter('zeepcentraal-http').createHistogram(
			'http.client.request.duration',
			{ unit: 's' },
		)
		httpDuration.record((performance.now() - started) / 1_000, {
			'http.request.method': method,
			...(responseStatus !== undefined
				? { 'http.response.status_code': responseStatus }
				: {}),
			'server.address': url.hostname,
		})
	}
}
