import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from 'bun:test'
import { InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { NodeSDK } from '@opentelemetry/sdk-node'

const consoleInfo = console.info
const infoSink = mock(() => {})
console.info = infoSink
const { installTelemetryConsoleBridge, uninstallTelemetryConsoleBridge } = await import('./logger')
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
