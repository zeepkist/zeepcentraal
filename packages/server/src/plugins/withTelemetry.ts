import { createElysiaTelemetryPlugin } from '@zeepkist/telemetry'
import { config } from '../config'

export const withTelemetry = createElysiaTelemetryPlugin({
	packageName: 'server',
	collectorUrl: config.otelCollectorUrl,
	nodeEnv: config.nodeEnv,
	serviceName: config.otelServiceName,
	serviceVersion: config.otelServiceVersion,
})
