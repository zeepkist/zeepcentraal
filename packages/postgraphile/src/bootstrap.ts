import { startNodeTelemetryFromEnvironment, stopNodeTelemetry } from '@zeepkist/telemetry'

const lightweight = process.argv.some(
	(argument) => argument === '--ready-check' || argument === '--healthcheck',
)

if (!lightweight) {
	startNodeTelemetryFromEnvironment('postgraphile', {
		autoInstrumentations: [],
	})
}

try {
	await import('./index')
} finally {
	if (!lightweight) await stopNodeTelemetry()
}
