import { opentelemetry } from '@elysia/opentelemetry'
import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc'
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
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import {
	createResourceAttributes,
	resolveTelemetryConfig,
	type TelemetryConfigInput,
	type TelemetryPackageName,
} from './config'
import { installTelemetryConsoleBridge, uninstallTelemetryConsoleBridge } from './logger'
import { registerRuntimeMemoryMetrics } from './runtimeMetrics'

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

let sdk: NodeSDK | undefined

export type NodeTelemetryOptions = TelemetryConfigInput & {
	autoInstrumentations?: readonly string[]
}

export function createTraceExporter(collectorUrl: string) {
	return new OTLPTraceExporter({ url: collectorUrl })
}

export function createMetricReader(collectorUrl: string) {
	return new PeriodicExportingMetricReader({
		exporter: new OTLPMetricExporter({ url: collectorUrl }),
		exportIntervalMillis: 10_000,
	})
}

export function createLogRecordProcessor(collectorUrl: string) {
	return new BatchLogRecordProcessor({ exporter: new OTLPLogExporter({ url: collectorUrl }) })
}

function autoInstrumentationConfig(enabledNames: readonly string[]) {
	const enabled = new Set(enabledNames)
	return {
		'@opentelemetry/instrumentation-http': { enabled: enabled.has('http') },
		'@opentelemetry/instrumentation-graphql': {
			enabled: enabled.has('graphql'),
			allowValues: false,
			depth: 0,
			ignoreResolveSpans: true,
			responseHook(span: { setAttribute(name: string, value: string): void }) {
				span.setAttribute('graphql.source', '[redacted]')
			},
		},
	} as const
}

function resolveAutoInstrumentations(defaultNames: readonly string[]) {
	const override = process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS
	const enabledNames = override
		? override
				.split(',')
				.map((name) => name.trim())
				.filter(Boolean)
		: [...defaultNames]

	if (override) return getNodeAutoInstrumentations(autoInstrumentationConfig(enabledNames))
	process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = enabledNames.join(',')
	try {
		return getNodeAutoInstrumentations(autoInstrumentationConfig(enabledNames))
	} finally {
		delete process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS
	}
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
	const plugin = opentelemetry(createElysiaTelemetryOptions(input))
	registerRuntimeMemoryMetrics()
	return plugin
}

export function startNodeTelemetry(input: NodeTelemetryOptions) {
	if (sdk) return false

	const config = resolveTelemetryConfig(input)
	sdk = new NodeSDK({
		resource: resourceFromAttributes(createResourceAttributes(config)),
		resourceDetectors: [
			envDetector,
			osDetector,
			processDetector,
			hostDetector,
			serviceInstanceIdDetector,
		],
		traceExporter: createTraceExporter(config.collectorUrl),
		metricReaders: [createMetricReader(config.collectorUrl)],
		logRecordProcessors: [createLogRecordProcessor(config.collectorUrl)],
		instrumentations: [resolveAutoInstrumentations(input.autoInstrumentations ?? ['http'])],
	})

	try {
		sdk.start()
		registerRuntimeMemoryMetrics()
		installTelemetryConsoleBridge()
		return true
	} catch (error) {
		sdk = undefined
		console.error('Error starting OpenTelemetry SDK', error)
		return false
	}
}

export function startNodeTelemetryFromEnvironment(
	packageName: TelemetryPackageName,
	options: { autoInstrumentations?: readonly string[] } = {},
) {
	return startNodeTelemetry({
		packageName,
		collectorUrl:
			process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
			process.env.OPENTELEMETRY_COLLECTOR_URL ??
			'http://localhost:4317',
		nodeEnv: process.env.NODE_ENV ?? 'development',
		serviceName: process.env.OTEL_SERVICE_NAME ?? process.env.OPENTELEMETRY_SERVICE_NAME,
		serviceVersion:
			process.env.OTEL_SERVICE_VERSION ?? process.env.OPENTELEMETRY_SERVICE_VERSION,
		autoInstrumentations: options.autoInstrumentations,
	})
}

export async function stopNodeTelemetry() {
	if (!sdk) return
	const currentSdk = sdk
	sdk = undefined
	try {
		await currentSdk.shutdown()
	} finally {
		uninstallTelemetryConsoleBridge()
	}
}

export function isNodeTelemetryStarted() {
	return sdk !== undefined
}
