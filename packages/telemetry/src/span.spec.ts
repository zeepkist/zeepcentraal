import { afterAll, describe, expect, test } from 'bun:test'
import { trace } from '@opentelemetry/api'
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { isWebErrorResponse, shouldRecordWebError } from '../../web/runtime/telemetryPolicy'
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
	test.each(['/missing-page', '/api/missing'])(
		'preserves web 404 status and thrown error for %s',
		async (path) => {
			const error = Object.assign(new Error('Page not found'), { statusCode: 404 })
			await expect(
				withActiveSpan(
					`GET ${path}`,
					{ shouldRecordError: shouldRecordWebError },
					async () => {
						throw error
					},
				),
			).rejects.toBe(error)
			const span = exporter
				.getFinishedSpans()
				.find((candidate) => candidate.name === `GET ${path}`)
			expect(span?.attributes['http.response.status_code']).toBe(404)
			expect(span?.events).toEqual([])
			expect(span?.status.code).toBe(1)
		},
	)

	test.each([
		new Error('Page not found'),
		Object.assign(new Error('Page not found'), { status: 500 }),
		Object.assign(new Error('Forbidden'), { statusCode: 403 }),
	])('keeps real web errors reportable: %p', async (error) => {
		const name = `reportable ${error.message} ${'status' in error ? error.status : ''}`
		await expect(
			withActiveSpan(name, { shouldRecordError: shouldRecordWebError }, async () => {
				throw error
			}),
		).rejects.toBe(error)
		const span = exporter.getFinishedSpans().find((candidate) => candidate.name === name)
		expect(span?.events.map((event) => event.name)).toEqual(['exception', 'error'])
		expect(span?.status.code).toBe(2)
	})

	test('other packages still report 404 exceptions by default', async () => {
		await expect(
			withActiveSpan('default 404', async () => {
				throw Object.assign(new Error('missing'), { statusCode: 404 })
			}),
		).rejects.toThrow('missing')
		const span = exporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'default 404')
		expect(span?.status.code).toBe(2)
		expect(span?.events.map((event) => event.name)).toEqual(['exception', 'error'])
	})

	test.each([404, 500])(
		'classifies web upstream HTTP %s without changing response',
		async (status) => {
			const response = new Response(null, { status })
			expect(
				await tracedFetch(
					'https://example.test/missing',
					{},
					{
						operationName: `web upstream ${status}`,
						fetch: (async () => response) as unknown as typeof fetch,
						isErrorResponse: isWebErrorResponse,
						shouldRecordError: shouldRecordWebError,
					},
				),
			).toBe(response)
			const span = exporter
				.getFinishedSpans()
				.find((candidate) => candidate.name === `web upstream ${status}`)
			expect(span?.attributes['http.response.status_code']).toBe(status)
			expect(span?.status.code).toBe(status === 404 ? 1 : 2)
			expect(span?.events.some((event) => event.name === 'error')).toBe(status !== 404)
		},
	)

	test('other packages still report HTTP 404 responses by default', async () => {
		await tracedFetch(
			'https://example.test/missing',
			{},
			{
				operationName: 'default upstream 404',
				fetch: (async () => new Response(null, { status: 404 })) as unknown as typeof fetch,
			},
		)
		const span = exporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'default upstream 404')
		expect(span?.status.code).toBe(2)
		expect(span?.events.some((event) => event.name === 'error')).toBe(true)
	})
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
