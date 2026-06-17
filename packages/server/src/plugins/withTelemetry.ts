import { opentelemetry } from '@elysiajs/opentelemetry';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import {
	envDetector,
	hostDetector,
	osDetector,
	processDetector,
	resourceFromAttributes,
	serviceInstanceIdDetector,
} from '@opentelemetry/resources';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { config } from '../config';

// https://elysiajs.com/patterns/opentelemetry
export const withTelemetry = opentelemetry({
	serviceName: config.otelServiceName,
	autoDetectResources: true,
	spanProcessors: [
		new BatchSpanProcessor(
			new OTLPTraceExporter({
				url: config.otelCollectorUrl,
			}),
		),
	],
	resource: resourceFromAttributes({
		'deployment.environment': process.env.NODE_ENV || 'development',
		'service.name': config.otelServiceName,
	}),
	resourceDetectors: [
		envDetector,
		osDetector,
		processDetector,
		hostDetector,
		serviceInstanceIdDetector,
	],
	instrumentations: [getNodeAutoInstrumentations()],
});

// No shutdown function needed - Elysia plugin handles SDK lifecycle
