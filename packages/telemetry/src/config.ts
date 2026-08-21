export type TelemetryPackageName =
	| 'core'
	| 'database'
	| 'server'
	| 'jobs'
	| 'migrate'
	| 'import-zsl'
	| 'postgraphile'
	| 'lobby-host'

export type TelemetryConfigInput = {
	packageName: TelemetryPackageName
	collectorUrl: string
	nodeEnv: string
	serviceName?: string
	serviceVersion?: string
}

export type TelemetryConfig = {
	packageName: TelemetryPackageName
	collectorUrl: string
	nodeEnv: string
	serviceName: string
	serviceVersion?: string
}

function optionalValue(value?: string) {
	return value && value.length > 0 ? value : undefined
}

export function getDefaultServiceName(packageName: TelemetryPackageName) {
	return `zeepcentraal-${packageName}-dev`
}

export function resolveTelemetryConfig(input: TelemetryConfigInput): TelemetryConfig {
	return {
		packageName: input.packageName,
		collectorUrl: input.collectorUrl,
		nodeEnv: input.nodeEnv,
		serviceName: optionalValue(input.serviceName) ?? getDefaultServiceName(input.packageName),
		serviceVersion: optionalValue(input.serviceVersion),
	}
}

export function createResourceAttributes(config: TelemetryConfig) {
	return {
		'deployment.environment': config.nodeEnv,
		'service.name': config.serviceName,
		...(config.serviceVersion ? { 'service.version': config.serviceVersion } : {}),
	}
}
