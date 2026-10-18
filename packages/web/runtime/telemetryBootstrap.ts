import { startNodeTelemetryFromEnvironment, stopNodeTelemetry } from '@zeepkist/telemetry'
import { shouldExportWebLog } from './telemetryPolicy'

startNodeTelemetryFromEnvironment('web', { shouldExportLog: shouldExportWebLog })
process.once('beforeExit', () => void stopNodeTelemetry())
try {
	await import(new URL('./index.mjs', import.meta.url).href)
} catch (error) {
	await stopNodeTelemetry()
	throw error
}
