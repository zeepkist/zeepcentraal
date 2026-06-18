import { trace } from '@opentelemetry/api'
import { Elysia } from 'elysia'

const SENSITIVE_QUERY_KEYS = new Set([
	'code',
	'state',
	'openid.sig',
	'openid.response_nonce',
	'openid.return_to',
])

export function sanitizeTelemetryUrl(input: string): string {
	const url = new URL(input)
	for (const key of SENSITIVE_QUERY_KEYS) {
		if (url.searchParams.has(key)) {
			url.searchParams.set(key, '[REDACTED]')
		}
	}
	return url.href
}

function setSpanAttributes(attributes: Record<string, string | number | boolean | undefined>) {
	const span = trace.getActiveSpan()
	if (!span) {
		return
	}

	const filteredAttributes = Object.fromEntries(
		Object.entries(attributes).filter(([, value]) => value !== undefined),
	)

	span.setAttributes(filteredAttributes)
}

export const withSpanEnrichment = new Elysia()
	.onRequest(({ request }) => {
		setSpanAttributes({
			'http.request.method': request.method,
			'url.full': sanitizeTelemetryUrl(request.url),
			'user_agent.original': request.headers.get('user-agent') ?? undefined,
		})
	})
	.onAfterHandle(({ set, route, path }) => {
		const span = trace.getActiveSpan()
		if (span && route) {
			span.updateName(route)
		}

		setSpanAttributes({
			'http.route': route,
			'url.path': path,
			'http.response.status_code': set.status ?? 200,
		})
	})
