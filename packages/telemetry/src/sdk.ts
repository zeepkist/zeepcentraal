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

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

let sdk: NodeSDK | undefined

export function createTraceExporter(collectorUrl: string) {
	return new OTLPTraceExporter({
		url: collectorUrl,
	})
}

export function createMetricReader(collectorUrl: string) {
	return new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({
			url: collectorUrl,
		}),
		exportIntervalMillis: 10_000,
	})
}

export function createElysiaTelemetryOptions(input: TelemetryConfigInput) {
	const config = resolveTelemetryConfig(input)

	return {
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
	}
}

export function createElysiaTelemetryPlugin(input: TelemetryConfigInput) {
	return opentelemetry(createElysiaTelemetryOptions(input))
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
