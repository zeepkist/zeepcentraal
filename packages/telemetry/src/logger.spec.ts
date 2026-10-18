import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { NodeSDK } from '@opentelemetry/sdk-node'

const consoleInfo = console.info
const infoSink = mock(() => {})
console.info = infoSink
const { installTelemetryConsoleBridge, uninstallTelemetryConsoleBridge } = await import('./logger')
const { shouldExportWebLog } = await import('../../web/runtime/telemetryPolicy')
console.info = consoleInfo

const exporter = new InMemoryLogRecordExporter()
const processor = new SimpleLogRecordProcessor({ exporter })
const sdk = new NodeSDK({ logRecordProcessors: [processor] })

beforeAll(() => {
	sdk.start()
})

afterEach(() => {
	uninstallTelemetryConsoleBridge()
})

afterAll(async () => {
	await sdk.shutdown()
})

async function lastLogBody() {
	await processor.forceFlush()
	return exporter.getFinishedLogRecords().at(-1)
}

describe('telemetry console bridge', () => {
	test('filters raw web 404 arguments while preserving console output', async () => {
		installTelemetryConsoleBridge({ shouldExportLog: shouldExportWebLog })
		const count = exporter.getFinishedLogRecords().length
		const error = Object.assign(new Error('Page not found: /missing'), { statusCode: 404 })
		console.info('[request error]', error)
		await processor.forceFlush()
		expect(exporter.getFinishedLogRecords()).toHaveLength(count)
		expect(infoSink).toHaveBeenLastCalledWith('[request error]', error)
	})

	test.each([
		new Error('Page not found'),
		Object.assign(new Error('Page not found'), { status: 500 }),
	])('exports web errors without confirmed 404 status: %p', async (error) => {
		installTelemetryConsoleBridge({ shouldExportLog: shouldExportWebLog })
		console.info('[request error]', error)
		const record = await lastLogBody()
		expect(String(record?.body)).toContain('Page not found')
	})

	test('exports 404 arguments by default for other packages', async () => {
		installTelemetryConsoleBridge()
		console.info('[request error]', { status: 404 })
		expect(String((await lastLogBody())?.body)).toContain('404')
	})

	test('keeps a real failure logged alongside a not-found error', async () => {
		installTelemetryConsoleBridge({ shouldExportLog: shouldExportWebLog })
		console.info('[request error]', { status: 404 }, new Error('Database failed'))
		expect(String((await lastLogBody())?.body)).toContain('Database failed')
	})
	test('renders printf-style Graphile Worker logs before export', async () => {
		installTelemetryConsoleBridge()
		console.info(
			'[%s%s] %s: %s',
			'worker',
			'(worker-1: updateLevelScore{42})',
			'INFO',
			'Completed task 42',
		)

		const record = await lastLogBody()
		expect(record?.body).toBe(
			'[worker(worker-1: updateLevelScore{42})] INFO: Completed task 42',
		)
		expect(record?.attributes['log.argument.count']).toBe(5)
		expect(infoSink).toHaveBeenCalledWith(
			'[%s%s] %s: %s',
			'worker',
			'(worker-1: updateLevelScore{42})',
			'INFO',
			'Completed task 42',
		)
	})

	test('redacts values introduced through substitutions', async () => {
		installTelemetryConsoleBridge()
		console.info('Request failed token=%s', 'private')

		const record = await lastLogBody()
		expect(record?.body).toBe('Request failed token=[redacted]')
	})

	test('formats structured arguments and bounds exported body size', async () => {
		installTelemetryConsoleBridge()
		console.info('Payload: %O', { value: 'x'.repeat(8_192) })

		const record = await lastLogBody()
		expect(record?.body).toStartWith('Payload: {')
		expect(String(record?.body)).toHaveLength(4_096)
		expect(record?.attributes['log.argument.count']).toBe(2)
	})
})
