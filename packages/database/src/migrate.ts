import { startNodeTelemetryFromEnvironment, stopNodeTelemetry } from '@zeepkist/telemetry'

startNodeTelemetryFromEnvironment('migrate')
try {
	await import('./migrateRuntime')
} finally {
	await stopNodeTelemetry()
}
