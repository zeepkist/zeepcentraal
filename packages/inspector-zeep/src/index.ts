import { startNodeTelemetryFromEnvironment, stopNodeTelemetry } from '@zeepkist/telemetry'
import { configSchema, parseOptions } from './config'

const options = parseOptions(process.argv.slice(2))
const path = process.env.INSPECTOR_CONFIG_FILE
if (!path) throw new Error('INSPECTOR_CONFIG_FILE is required')
const config = configSchema.parse(await Bun.file(path).json())
function required(name: string) {
	const value = process.env[name]
	if (!value) throw new Error(`${name} is required`)
	return value
}
const credentials = {
	discordToken: required('INSPECTOR_DISCORD_TOKEN'),
	steamApiKey: required('STEAM_API_KEY'),
	appId: required('STEAM_APP_ID'),
	steamcmd: required('STEAMCMD_PATH'),
}
startNodeTelemetryFromEnvironment('inspector-zeep')
const { closeDatabase } = await import('@zeepkist/database')
const { runInspector } = await import('./run')
const controller = new AbortController()
let forceExit: ReturnType<typeof setTimeout> | undefined
const stop = () => {
	controller.abort()
	forceExit ??= setTimeout(() => process.exit(1), 30_000)
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
const timeout = setTimeout(stop, config.runTimeoutMs)
try {
	await runInspector(config, { ...options, ...credentials, signal: controller.signal })
} catch {
	console.error('Inspector run failed; deferred work will retry next run.')
	process.exitCode = 1
} finally {
	clearTimeout(timeout)
	await closeDatabase()
	await stopNodeTelemetry()
	if (forceExit) clearTimeout(forceExit)
}
