import type { LobbyHostFileConfig } from '@zeepkist/core/config/lobby-host'
import { closeDatabase } from '@zeepkist/database'
import { stopNodeTelemetry } from '@zeepkist/telemetry'
import { LevelPayloadCache } from './assets/levelPayloadCache'
import { RoomBrokerClient } from './broker/roomBrokerClient'
import { createSubscriptionClient } from './leaderboard/graphqlClient'
import { createProfile } from './profiles/createProfile'
import { TrackTournamentLeaderboardHub } from './profiles/trackTournament/leaderboard/trackTournamentLeaderboard'
import { safeError } from './runtime/helpers'
import { LobbyHostSupervisor } from './runtime/lobbyHostSupervisor'
import { ManagedLobbyHost } from './runtime/managedLobbyHost'
import { roomLogger } from './runtime/telemetry'

export async function runLobbyHost(config: {
	brokerToken: string
	brokerUrl: string
	file: LobbyHostFileConfig
	graphqlWsUrl: string
}) {
	const broker = new RoomBrokerClient(config.brokerUrl, config.brokerToken)
	const leaderboard = new TrackTournamentLeaderboardHub(
		config.graphqlWsUrl,
		(error) =>
			console.warn(`Track tournament leaderboard subscription failed: ${safeError(error)}`),
		createSubscriptionClient(config.graphqlWsUrl),
	)
	const shared = { payloads: new LevelPayloadCache(), leaderboard }
	const supervisor = new LobbyHostSupervisor(
		config.file.rooms.map((room) => ({
			key: room.key,
			host: new ManagedLobbyHost(
				room,
				broker,
				createProfile(room, shared, roomLogger(room.key)),
			),
		})),
		() => leaderboard.close(),
	)
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
