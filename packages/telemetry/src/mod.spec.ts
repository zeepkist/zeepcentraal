import { afterAll, expect, test } from 'bun:test'
import { trace } from '@opentelemetry/api'
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'
import { getModTraceAttributes } from './mod'
import { startHttpServerSpan } from './span'

const exporter = new InMemorySpanExporter()
const provider = new BasicTracerProvider({
	spanProcessors: [new SimpleSpanProcessor(exporter)],
})
trace.setGlobalTracerProvider(provider)
afterAll(() => provider.shutdown())

test('maps headers to string attributes without losing Steam ID precision', () => {
	const headers = {
		'X-GtR-Version': '2.0.0',
		'X-Zeepkist-Version': '1.2.3',
		'x-zeepkist-major-version': '1',
		'X-Steam-ID': '76561198000000001',
		authorization: 'Bearer fake',
		constructor: 'ignored',
	}
	const expected = {
		'mod.version': '2.0.0',
		'mod.zeepkistVersion': '1.2.3',
		'mod.zeepkistMajorVersion': '1',
		'mod.steamId': '76561198000000001',
	}
	expect(getModTraceAttributes(headers)).toEqual(expected)
	expect(getModTraceAttributes(new Headers(headers))).toEqual(expected)
	startHttpServerSpan({ method: 'GET', url: 'https://example.test/mod', headers }, (span) => {
		span.end()
	})
	const attributes = exporter.getFinishedSpans().at(-1)?.attributes
	expect(attributes).toMatchObject(expected)
	expect(
		Object.keys(attributes ?? {}).filter((key) => key.startsWith('graphql.header.')),
	).toEqual([])
})

test('omits missing, empty, invalid and ambiguous values', () => {
	expect(getModTraceAttributes(new Headers())).toEqual({})
	expect(
		getModTraceAttributes({
			'x-gtr-version': '',
			'x-zeepkist-version': '  ',
			'x-zeepkist-major-version': '\t',
			'x-steam-id': ['1', '2'],
		}),
	).toEqual({})
	expect(getModTraceAttributes({ 'x-gtr-version': '2\n0' })).toEqual({})
	expect(getModTraceAttributes({ 'x-gtr-version': 'é' })).toEqual({})
	expect(getModTraceAttributes({ 'x-gtr-version': '2' })).toEqual({ 'mod.version': '2' })
	startHttpServerSpan(
		{ method: 'GET', url: 'https://example.test/empty', headers: new Headers() },
		(span) => span.end(),
	)
	expect(
		Object.keys(exporter.getFinishedSpans().at(-1)?.attributes ?? {}).filter((key) =>
			key.startsWith('mod.'),
		),
	).toEqual([])
})
