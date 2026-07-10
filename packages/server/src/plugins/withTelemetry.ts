import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { Elysia } from 'elysia'
import { config } from '../config'

export function createWithTelemetry() {
	if (process.env.ZEEPCENTRAAL_TEST === '1') {
		return new Elysia()
	}

	return createElysiaTelemetryPlugin({
		packageName: 'server',
		collectorUrl: config.otelCollectorUrl,
		nodeEnv: config.nodeEnv,
		serviceName: config.otelServiceName,
		serviceVersion: config.otelServiceVersion,
	})
}
