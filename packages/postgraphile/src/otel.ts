import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions'
import { postgraphileConfig } from '@zeepkist/core/config/postgraphile'

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

const traceExporter = new OTLPTraceExporter({
	url: postgraphileConfig.otel.collectorUrl,
})

const metricExporter = new OTLPMetricExporter({
	url: postgraphileConfig.otel.collectorUrl,
})

export const sdk = new NodeSDK({
	resource: resourceFromAttributes({
		[ATTR_SERVICE_NAME]: postgraphileConfig.otel.serviceName,
	}),
	traceExporter,
	metricReaders: [
		new PeriodicExportingMetricReader({
			exporter: metricExporter,
			exportIntervalMillis: 10_000,
		}),
	],
	instrumentations: [
		getNodeAutoInstrumentations({
			// Bun 1.3.x does not support node:v8.getHeapSpaceStatistics
			'@opentelemetry/instrumentation-runtime-node': {
				enabled: false,
			},
		}),
	],
})

export function startTelemetry() {
	try {
		sdk.start()
	} catch (error) {
		console.error('Error starting the SDK', error)
	}
}

export async function stopTelemetry() {
	await sdk.shutdown()
}
