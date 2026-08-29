import { startNodeTelemetryFromEnvironment, stopNodeTelemetry } from '@zeepkist/telemetry'

if (import.meta.main) {
	const selfTest = process.argv.includes('--self-test')
	if (!selfTest) startNodeTelemetryFromEnvironment('discord')
	try {
		const { runDiscordEntrypoint } = await import('./runtime')
		await runDiscordEntrypoint(true)
	} finally {
		if (!selfTest) await stopNodeTelemetry()
	}
}
