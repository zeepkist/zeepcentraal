import type { Worker } from 'node:cluster'
import type { LobbySnapshot } from '@zeepkist/core'
import { config } from '../../config'
import { LobbyCollector } from './lobbyCollector'
import { sendLobbySnapshot } from './lobbyIpc'
import { unavailableLobbySnapshot } from './lobbyStore'

export function startLobbyPrimary(getWorkers: () => Worker[]) {
	let snapshot: LobbySnapshot = unavailableLobbySnapshot
	const publish = (next: LobbySnapshot) => {
		snapshot = next
		for (const worker of getWorkers()) {
			sendLobbySnapshot(worker, snapshot)
		}
	}

	if (!config.lobby.enabled) {
		return { getSnapshot: () => snapshot, stop: () => {} }
	}
	if (!config.lobby.host || !config.lobby.build || !config.lobby.port) {
		throw new Error('Enabled lobby collector has incomplete configuration')
	}
	const collector = new LobbyCollector(
		{
			appId: config.steamAppId,
			host: config.lobby.host,
			port: config.lobby.port,
			build: config.lobby.build,
			refreshTokenFile: config.lobby.refreshTokenFile,
		},
		publish,
	)
	collector.start()
	return { getSnapshot: () => snapshot, stop: () => collector.stop() }
}
