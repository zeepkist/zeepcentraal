import type { LobbyHostFileConfig } from '@zeepkist/core/config/lobby-host'
import { closeDatabase } from '@zeepkist/database'
import { stopNodeTelemetry } from '@zeepkist/telemetry'
import { LobbyHostSupervisor } from './lobbyHostSupervisor'

export async function runLobbyHost(config: {
	brokerToken: string
	brokerUrl: string
	file: LobbyHostFileConfig
	graphqlWsUrl: string
}) {
	const supervisor = new LobbyHostSupervisor(config)
	let stopping = false
	async function shutdown(signal: NodeJS.Signals) {
		if (stopping) return
		stopping = true
		console.info(
			`Lobby host received ${signal}; making managed rooms private and disconnecting.`,
		)
		let failed = false
		try {
			await supervisor.stop()
		} catch {
			failed = true
			console.error('Lobby host rooms did not stop cleanly.')
		}
		try {
			await closeDatabase()
		} catch {
			failed = true
			console.error('Lobby host database pool did not close cleanly.')
		}
		await stopNodeTelemetry().catch(() => {
			failed = true
		})
		process.exit(failed ? 1 : 0)
	}

	process.on('SIGINT', () => void shutdown('SIGINT'))
	process.on('SIGTERM', () => void shutdown('SIGTERM'))
	await supervisor.run()
}
