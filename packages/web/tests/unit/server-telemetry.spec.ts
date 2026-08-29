import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

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
