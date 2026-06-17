import { Elysia } from 'elysia';
import { trace } from '@opentelemetry/api';

function setSpanAttributes(attributes: Record<string, string | number | boolean | undefined>) {
	const span = trace.getActiveSpan();
	if (!span) {
		return;
	}

	const filteredAttributes = Object.fromEntries(
		Object.entries(attributes).filter(([, value]) => value !== undefined),
	);

	span.setAttributes(filteredAttributes);
}

export const withSpanEnrichment = new Elysia()
	.onRequest(({ request }) => {
		setSpanAttributes({
			'http.request.method': request.method,
			'url.full': request.url,
			'user_agent.original': request.headers.get('user-agent') ?? undefined,
		});
	})
	.onAfterHandle(({ set, route, path }) => {
		const span = trace.getActiveSpan();
		if (span && route) {
			span.updateName(route);
		}

		setSpanAttributes({
			'http.route': route,
			'url.path': path,
			'http.response.status_code': set.status ?? 200,
		});
	});
