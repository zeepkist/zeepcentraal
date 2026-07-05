import { opentelemetry } from '@elysiajs/opentelemetry'
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import {
	envDetector,
	hostDetector,
	osDetector,
	processDetector,
	resourceFromAttributes,
	serviceInstanceIdDetector,
} from '@opentelemetry/resources'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import {
	createResourceAttributes,
	resolveTelemetryConfig,
	type TelemetryConfigInput,
} from './config'
import { createNodeAutoInstrumentations } from './instrumentation'

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

let sdk: NodeSDK | undefined

function createTraceExporter(collectorUrl: string) {
	return new OTLPTraceExporter({
		url: collectorUrl,
	})
}

function createMetricReader(collectorUrl: string) {
	return new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({
			url: collectorUrl,
		}),
		exportIntervalMillis: 10_000,
	})
}

export function createElysiaTelemetryPlugin(input: TelemetryConfigInput) {
	const config = resolveTelemetryConfig(input)

	return opentelemetry({
		serviceName: config.serviceName,
		autoDetectResources: true,
		spanProcessors: [new BatchSpanProcessor(createTraceExporter(config.collectorUrl))],
		metricReaders: [createMetricReader(config.collectorUrl)],
		resource: resourceFromAttributes(createResourceAttributes(config)),
		resourceDetectors: [
			envDetector,
			osDetector,
			processDetector,
			hostDetector,
			serviceInstanceIdDetector,
		],
		instrumentations: [createNodeAutoInstrumentations()],
	})
}

export function startNodeTelemetry(input: TelemetryConfigInput) {
	if (sdk) {
		return
	}

	const config = resolveTelemetryConfig(input)
	sdk = new NodeSDK({
		resource: resourceFromAttributes(createResourceAttributes(config)),
		traceExporter: createTraceExporter(config.collectorUrl),
		metricReaders: [createMetricReader(config.collectorUrl)],
		instrumentations: [createNodeAutoInstrumentations()],
	})

	try {
		sdk.start()
	} catch (error) {
		console.error('Error starting the SDK', error)
	}
}

export async function stopNodeTelemetry() {
	if (!sdk) {
		return
	}

	const currentSdk = sdk
	sdk = undefined
	await currentSdk.shutdown()
}
