import { config as coreConfig } from '@zeepkist/core';

export const config = {
	host: coreConfig.api.host,
	port: coreConfig.api.port,
	otelCollectorUrl: coreConfig.otel.collectorUrl,
	otelServiceName: coreConfig.otel.serviceName,
} as const;
