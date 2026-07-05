import { describe, expect, test } from 'bun:test'
import { createResourceAttributes, resolveTelemetryConfig } from './config'
import { createNodeAutoInstrumentations } from './instrumentation'

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

	test('runtime-node instrumentation disabled for Bun', () => {
		const runtimeNodeInstrumentation = createNodeAutoInstrumentations().find(
			(instrumentation) =>
				instrumentation.instrumentationName ===
				'@opentelemetry/instrumentation-runtime-node',
		)

		expect(runtimeNodeInstrumentation).toBeUndefined()
	})
})
