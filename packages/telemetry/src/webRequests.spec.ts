import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { trace } from '@opentelemetry/api'
import { logs } from '@opentelemetry/api-logs'
import {
	InMemoryLogRecordExporter,
	LoggerProvider,
	SimpleLogRecordProcessor,
} from '@opentelemetry/sdk-logs'
import {
	BasicTracerProvider,
	InMemorySpanExporter,
	SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-base'

const previousConsoleError = console.error
const consoleSink = mock(() => {})
console.error = consoleSink
const { installTelemetryConsoleBridge, uninstallTelemetryConsoleBridge } = await import('./logger')
const { shouldExportWebLog } = await import('../../web/runtime/telemetryPolicy')
console.error = previousConsoleError

type RequestEvent = {
	method: string
	path: string
	node: { res: { statusCode: number } }
	context: { matchedRoute: { path: string } }
}
type Handler = (event: RequestEvent) => Promise<string>
type NitroApp = { h3App: { handler: Handler } }

mock.module('h3', () => ({
	getRequestURL: (event: RequestEvent) => new URL(event.path, 'https://web.example.test'),
	getRequestHeaders: () => ({}),
}))
mock.module('nitropack/runtime', () => ({ defineNitroPlugin: (plugin: unknown) => plugin }))

const spanExporter = new InMemorySpanExporter()
const spanProvider = new BasicTracerProvider({
	spanProcessors: [new SimpleSpanProcessor(spanExporter)],
})
trace.setGlobalTracerProvider(spanProvider)
const logExporter = new InMemoryLogRecordExporter()
const logProvider = new LoggerProvider({
	processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
})
logs.setGlobalLoggerProvider(logProvider)
const plugin = (await import('../../web/server/plugins/telemetry')).default as unknown as (
	app: NitroApp,
) => void

beforeEach(() => {
	installTelemetryConsoleBridge({ shouldExportLog: shouldExportWebLog })
})

afterEach(() => {
	uninstallTelemetryConsoleBridge()
})

afterAll(async () => {
	uninstallTelemetryConsoleBridge()
	await spanProvider.shutdown()
	await logProvider.shutdown()
})

describe('web request telemetry', () => {
	test('rethrows unexpected 404 exceptions without recording an error', async () => {
		const error = Object.assign(new Error('Missing API resource'), { status: 404 })
		const app: NitroApp = {
			h3App: {
				handler: async () => {
					throw error
				},
			},
		}
		plugin(app)
		await expect(
			app.h3App.handler({
				method: 'GET',
				path: '/api/throwing',
				node: { res: { statusCode: 200 } },
				context: { matchedRoute: { path: '/api/throwing' } },
			}),
		).rejects.toBe(error)
		const span = spanExporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'GET /api/throwing')
		expect(span?.attributes['http.response.status_code']).toBe(404)
		expect(span?.status.code).toBe(1)
		expect(span?.events).toEqual([])
	})

	test.each(['/missing-page', '/api/missing'])(
		'retains normal 404 trace and console output for %s',
		async (path) => {
			const error = Object.assign(new Error('Page not found'), { statusCode: 404 })
			const app: NitroApp = {
				h3App: {
					handler: async (event) => {
						console.error('[request error]', error)
						event.node.res.statusCode = 404
						return 'existing 404 body'
					},
				},
			}
			plugin(app)
			expect(
				await app.h3App.handler({
					method: 'GET',
					path,
					node: { res: { statusCode: 200 } },
					context: { matchedRoute: { path } },
				}),
			).toBe('existing 404 body')
			const span = spanExporter
				.getFinishedSpans()
				.find((candidate) => candidate.name === `GET ${path}`)
			expect(span?.attributes['http.response.status_code']).toBe(404)
			expect(span?.events.map((event) => event.name)).toEqual(['web.request.completed'])
			expect(span?.status.code).toBe(1)
			expect(logExporter.getFinishedLogRecords()).toEqual([])
			expect(consoleSink).toHaveBeenLastCalledWith('[request error]', error)
		},
	)

	test('retains 500 response errors and their logs', async () => {
		const app: NitroApp = {
			h3App: {
				handler: async (event) => {
					console.error(
						'[request error]',
						Object.assign(new Error('Page not found'), { status: 500 }),
					)
					event.node.res.statusCode = 500
					return 'existing 500 body'
				},
			},
		}
		plugin(app)
		await app.h3App.handler({
			method: 'GET',
			path: '/broken',
			node: { res: { statusCode: 200 } },
			context: { matchedRoute: { path: '/broken' } },
		})
		const span = spanExporter
			.getFinishedSpans()
			.find((candidate) => candidate.name === 'GET /broken')
		expect(span?.status.code).toBe(2)
		expect(span?.events.map((event) => event.name)).toEqual(['web.request.completed', 'error'])
		expect(String(logExporter.getFinishedLogRecords().at(-1)?.body)).toContain('Page not found')
	})
})
