import { describe, expect, test } from 'bun:test'
import { ProxyTracerProvider, trace } from '@opentelemetry/api'
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base'
import { createResourceAttributes, resolveTelemetryConfig } from './config'
import { createElysiaTelemetryOptions } from './sdk'
import { injectTraceHeaders, startActiveSpan, withExtractedTraceContext } from './span'

const tracerProvider = trace.getTracerProvider()
if (
	tracerProvider instanceof ProxyTracerProvider &&
	tracerProvider.getDelegateTracer('zeepcentraal') === undefined
) {
	trace.setGlobalTracerProvider(new BasicTracerProvider())
}

describe('telemetry config', () => {
	test('defaults local service name from package name', () => {
		const config = resolveTelemetryConfig({
			packageName: 'postgraphile',
			collectorUrl: 'http://localhost:4317',
			nodeEnv: 'development',
		})

		expect(config.serviceName).toBe('zeepcentraal-postgraphile-dev')
	})

	test('service name override wins', () => {
		const config = resolveTelemetryConfig({
			packageName: 'server',
			collectorUrl: 'http://localhost:4317',
			nodeEnv: 'production',
			serviceName: 'zeepcentraal-server',
		})

		expect(config.serviceName).toBe('zeepcentraal-server')
	})

	test('service version resource attribute included only when set', () => {
		const withoutVersion = resolveTelemetryConfig({
			packageName: 'server',
			collectorUrl: 'http://localhost:4317',
			nodeEnv: 'development',
		})
		const withVersion = resolveTelemetryConfig({
			packageName: 'server',
			collectorUrl: 'http://localhost:4317',
			nodeEnv: 'production',
			serviceVersion: '1.2.3',
		})

		expect(createResourceAttributes(withoutVersion)).not.toHaveProperty('service.version')
		expect(createResourceAttributes(withVersion)).toMatchObject({
			'service.version': '1.2.3',
		})
	})

	test('elysia telemetry options keep gRPC collector URL and no auto instrumentations', () => {
		const options = createElysiaTelemetryOptions({
			packageName: 'server',
			collectorUrl: 'https://ingress.zeepki.st:443',
			nodeEnv: 'production',
			serviceName: 'zeepcentraal-server',
		})

		expect(options.serviceName).toBe('zeepcentraal-server')
		expect(options.spanProcessors).toHaveLength(1)
		expect(options.metricReaders).toHaveLength(1)
		expect(options).not.toHaveProperty('instrumentations')
	})

	test('propagation injects trace headers from active span', () => {
		const headers = startActiveSpan('test span', () => injectTraceHeaders())
		const traceparent = headers.get('traceparent')

		expect(traceparent).toMatch(/^00-[a-f0-9]{32}-[a-f0-9]{16}-0[01]$/)
	})

	test('propagation extracts inbound trace context', () => {
		const inboundTraceId = '4bf92f3577b34da6a3ce929d0e0e4736'
		const injectedHeaders = withExtractedTraceContext(
			{
				traceparent: `00-${inboundTraceId}-00f067aa0ba902b7-01`,
			},
			() => startActiveSpan('child span', () => injectTraceHeaders()),
		)

		expect(injectedHeaders.get('traceparent')).toContain(inboundTraceId)
	})
})
