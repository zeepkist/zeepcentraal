import { serverConfig } from '@zeepkist/core/config/server'

export const config = {
	host: serverConfig.api.host,
	port: serverConfig.api.port,
	maxRequestBodySize: serverConfig.api.maxRequestBodySize,
	nodeEnv: serverConfig.nodeEnv,
	otelCollectorUrl: serverConfig.otel.collectorUrl,
	otelServiceName: serverConfig.otel.serviceName,
	otelServiceVersion: serverConfig.otel.serviceVersion,
	steamAppId: serverConfig.steam.appId,
	lobby: serverConfig.lobby,
} as const
