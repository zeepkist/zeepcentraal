import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveTelemetryRoute } from '../../server/utils/telemetryRoute'

const requestPlugin = readFileSync(
	new URL('../../server/plugins/telemetry.ts', import.meta.url),
	'utf8',
)
const serverUrql = readFileSync(
	new URL('../../app/plugins/urql.server.ts', import.meta.url),
	'utf8',
)
const clientUrql = readFileSync(
	new URL('../../app/plugins/urql.client.ts', import.meta.url),
	'utf8',
)

describe('server telemetry contracts', () => {
	it('wraps SSR and API requests with propagated status-aware spans', () => {
		expect(requestPlugin).toContain('withExtractedTraceContext(getRequestHeaders(event)')
		expect(requestPlugin).toContain("url.pathname.startsWith('/api/') ? 'api' : 'ssr'")
		expect(requestPlugin).toContain("span.addEvent('web.request.completed'")
		expect(requestPlugin).toContain('if (status >= 500)')
		expect(requestPlugin).toContain("span.addEvent('error'")
	})

	it('uses matched route path for span names and http.route', () => {
		expect(resolveTelemetryRoute({ path: '/api/users/:id' }, '/api/users/123')).toBe(
			'/api/users/:id',
		)
		expect(resolveTelemetryRoute({ handlers: {} }, '/users/123')).toBe('/users/123')
		expect(resolveTelemetryRoute(null, '/users/123')).toBe('/users/123')
		expect(requestPlugin).toContain(
			'resolveTelemetryRoute(event.context.matchedRoute, url.pathname)',
		)
		expect(requestPlugin).not.toContain('String(event.context.matchedRoute')
	})

	it('excludes health, Nuxt assets, and static files', () => {
		expect(requestPlugin).toContain("url.pathname === '/healthz'")
		expect(requestPlugin).toContain('^\\/_nuxt\\/')
		expect(requestPlugin).toContain('STATIC_PATH.test(url.pathname)')
	})

	it('keeps traced GraphQL fetch server-only', () => {
		expect(serverUrql).toContain("from '@zeepkist/telemetry'")
		expect(serverUrql).toContain('tracedFetch(')
		expect(clientUrql).not.toContain('@zeepkist/telemetry')
		expect(clientUrql).not.toContain('traceparent')
	})
})
