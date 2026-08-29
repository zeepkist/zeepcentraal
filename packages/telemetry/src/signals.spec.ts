import { afterAll, describe, expect, test } from 'bun:test'
import { InMemoryLogRecordExporter, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs'
import {
	AggregationTemporality,
	InMemoryMetricExporter,
	PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { emitTelemetryLog } from './logger'
import { getMeter, injectTraceCarrier, startActiveSpan } from './span'

const spanExporter = new InMemorySpanExporter()
const logExporter = new InMemoryLogRecordExporter()
const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE)
const spanProcessor = new SimpleSpanProcessor(spanExporter)
const logProcessor = new SimpleLogRecordProcessor({ exporter: logExporter })
const metricReader = new PeriodicExportingMetricReader({
	exporter: metricExporter,
	exportIntervalMillis: 60_000,
})
const sdk = new NodeSDK({
	logRecordProcessors: [logProcessor],
	metricReaders: [metricReader],
	spanProcessors: [spanProcessor],
})
sdk.start()

afterAll(async () => {
	await sdk.shutdown()
})

describe('telemetry signals', () => {
	test('correlates redacted logs with active trace', async () => {
		const carrier = startActiveSpan('log parent', (span) => {
			emitTelemetryLog('error', 'request failed token=private')
			const activeCarrier = injectTraceCarrier()
			span.end()
			return activeCarrier
		})
		await logProcessor.forceFlush()
		const record = logExporter.getFinishedLogRecords().at(-1)

		expect(record?.body).toBe('request failed token=[redacted]')
		expect(record?.spanContext?.traceId).toBe(carrier.traceparent?.split('-')[1])
	})

	test('exports low-cardinality metrics', async () => {
		getMeter('signals-test').createCounter('telemetry.test.operations').add(1, {
			outcome: 'success',
		})
		await metricReader.forceFlush()
		const names = metricExporter
			.getMetrics()
			.flatMap((resource) => resource.scopeMetrics)
			.flatMap((scope) => scope.metrics)
			.map((metric) => metric.descriptor.name)

		expect(names).toContain('telemetry.test.operations')
	})
})
