import { afterAll, expect, test } from 'bun:test'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { buildPostGraphileServer } from '../../postgraphile/src/server'

const exporter = new InMemorySpanExporter()
const sdk = new NodeSDK({
	autoDetectResources: false,
	metricReaders: [],
	logRecordProcessors: [],
	spanProcessors: [new SimpleSpanProcessor(exporter)],
})
sdk.start()
afterAll(() => sdk.shutdown())

test('PostGraphile exports one compact server span for each GraphQL request and skips probes', async () => {
	const fixture = {
		createServ() {
			return {
				async handleGraphQLRequest() {
					return Response.json({ data: { ok: true } })
				},
				async handleGraphiQLStaticRequest() {
					return null
				},
			}
		},
		getSchema() {
			throw new Error('Fixture only serves HTTP requests')
		},
	}
	const app = buildPostGraphileServer(fixture as never, {
		check: async () => ({ ok: false }),
		dispose: async () => {},
	})
	const traceId = '4bf92f3577b34da6a3ce929d0e0e4736'
	const parentSpanId = '00f067aa0ba902b7'
	const request = (query: string) =>
		app.handle(
			new Request('http://localhost/?token=private-url', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					traceparent: `00-${traceId}-${parentSpanId}-01`,
					'x-steam-id': '76561198000000001',
				},
				body: JSON.stringify({ query, variables: { fixture: 'private-variable' } }),
			}),
		)

	expect((await request('query Fixture { ok }')).status).toBe(200)
	expect((await request('query PrivateDocument {')).status).toBe(400)
	expect((await app.handle(new Request('http://localhost/readyz'))).status).toBe(503)
	expect((await app.handle(new Request('http://localhost/healthz'))).status).toBe(200)

	const spans = exporter.getFinishedSpans()
	expect(spans).toHaveLength(2)
	expect(spans.every((span) => span.spanContext().traceId === traceId)).toBe(true)
	expect(spans.every((span) => span.parentSpanContext?.spanId === parentSpanId)).toBe(true)
	expect(spans[0]?.name).toBe('query Fixture')
	expect(spans[0]?.attributes).toMatchObject({
		'http.route': '/',
		'http.response.status_code': 200,
		'graphql.queryCost.cost': expect.any(Number),
		'mod.steamId': '76561198000000001',
	})
	expect(spans[1]?.attributes['graphql.queryCost.rejection_reason']).toBe('syntax')
	expect(spans[1]?.events.map((event) => event.name)).toEqual(['error'])
	expect(JSON.stringify(spans.map((span) => span.attributes))).not.toContain('private-')
})
