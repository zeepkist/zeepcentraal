import { serverConfig } from '@zeepkist/core/config'

export const config = {
	host: serverConfig.api.host,
	port: serverConfig.api.port,
	nodeEnv: serverConfig.nodeEnv,
	otelCollectorUrl: serverConfig.otel.collectorUrl,
	otelServiceName: serverConfig.otel.serviceName,
} as const
