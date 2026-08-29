import { afterAll, describe, expect, test } from 'bun:test'
import { trace } from '@opentelemetry/api'
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { sanitizeUrl, tracedFetch } from './fetch'
import { redactLogMessage } from './logger'
import { withActiveSpan } from './span'

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({
	spanProcessors: [new SimpleSpanProcessor(exporter)],
})
trace.setGlobalTracerProvider(provider)

afterAll(async () => {
	await provider.shutdown()
})

describe('telemetry helpers', () => {
	test('auto-ends successful async spans', async () => {
		await withActiveSpan('successful operation', async (span) => {
			span.addEvent('completed', { count: 2 })
		})
		const span = exporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'successful operation')
		expect(span?.events.map((event) => event.name)).toContain('completed')
		expect(span?.status.code).toBe(1)
	})

	test('records exception and error events', async () => {
		await expect(
			withActiveSpan('failed operation', async () => {
				throw new Error('expected failure')
			}),
		).rejects.toThrow('expected failure')
		const span = exporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'failed operation')
		expect(span?.events.map((event) => event.name)).toEqual(['exception', 'error'])
		expect(span?.status.code).toBe(2)
	})

	test('redacts URL query values and credentials', () => {
		const url = sanitizeUrl('https://user:password@example.test/path?key=secret&page=10')
		expect(url.username).toBe('')
		expect(url.password).toBe('')
		expect(url.searchParams.get('key')).toBe('[redacted]')
		expect(url.searchParams.get('page')).toBe('*')
	})

	test('redacts common secrets from correlated log bodies', () => {
		expect(redactLogMessage('Bearer abc https://x.test/?token=secret')).toBe(
			'Bearer [redacted] https://x.test/?token=[redacted]',
		)
	})

	test('records HTTP error responses as error events', async () => {
		await tracedFetch(
			'https://example.test/path?token=private',
			{},
			{
				fetch: (async () =>
					new Response('failed', { status: 503 })) as unknown as typeof fetch,
			},
		)
		const span = exporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'GET example.test')
		expect(span?.attributes['url.full']).toBe('https://example.test/path?token=%5Bredacted%5D')
		expect(span?.events.map((event) => event.name)).toContain('error')
		expect(span?.status.code).toBe(2)
	})
})
