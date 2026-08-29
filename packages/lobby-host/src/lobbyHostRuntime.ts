import { lobbyHostConfig } from '@zeepkist/core/config/lobby-host'
import { closeDatabase } from '@zeepkist/database'
import { stopNodeTelemetry } from '@zeepkist/telemetry'
import { TotwLobbyHost } from './totwLobbyHost'

if (!lobbyHostConfig.enabled) {
	console.info('Track of the Week lobby host is disabled.')
	await new Promise<void>((resolve) => {
		process.once('SIGINT', resolve)
		process.once('SIGTERM', resolve)
	})
	await stopNodeTelemetry()
	process.exit(0)
}

const host = new TotwLobbyHost({
	assetPollMs: lobbyHostConfig.assetPollMs,
	brokerToken: lobbyHostConfig.brokerToken as string,
	brokerUrl: lobbyHostConfig.brokerUrl,
	reconnectMaxMs: lobbyHostConfig.reconnectMaxMs,
	roundTimeSeconds: lobbyHostConfig.roundTimeSeconds,
})

let stopping = false
async function shutdown(signal: NodeJS.Signals) {
	if (stopping) return
	stopping = true
	console.info(`TotW lobby host received ${signal}; making room private and disconnecting.`)
	try {
		await host.stop()
		await closeDatabase()
		await stopNodeTelemetry()
		process.exit(0)
	} catch {
		console.error('TotW lobby host did not stop cleanly.')
		await stopNodeTelemetry().catch(() => undefined)
		process.exit(1)
	}
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
await host.run()
