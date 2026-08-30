import { lobbyHostConfig, parseLobbyHostFileConfig } from '@zeepkist/core/config/lobby-host'
import { startNodeTelemetryFromEnvironment } from '@zeepkist/telemetry'

if (!lobbyHostConfig.enabled) {
	console.info('Lobby host is disabled.')
	await new Promise<void>((resolve) => {
		process.once('SIGINT', resolve)
		process.once('SIGTERM', resolve)
	})
	process.exit(0)
}

const configFile = lobbyHostConfig.configFile as string
let value: unknown
try {
	value = await Bun.file(configFile).json()
} catch {
	throw new Error('Lobby host configuration file could not be read')
}
const file = parseLobbyHostFileConfig(value)
startNodeTelemetryFromEnvironment('lobby-host')
const { runLobbyHost } = await import('./lobbyHostRuntime')
await runLobbyHost({
	brokerToken: lobbyHostConfig.brokerToken as string,
	brokerUrl: lobbyHostConfig.brokerUrl,
	file,
	graphqlWsUrl: lobbyHostConfig.graphqlWsUrl,
})
