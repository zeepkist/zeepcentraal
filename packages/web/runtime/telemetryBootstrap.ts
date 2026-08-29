import { startNodeTelemetryFromEnvironment, stopNodeTelemetry } from '@zeepkist/telemetry'

startNodeTelemetryFromEnvironment('web')
process.once('beforeExit', () => void stopNodeTelemetry())
try {
	await import(new URL('./index.mjs', import.meta.url).href)
} catch (error) {
	await stopNodeTelemetry()
	throw error
}
