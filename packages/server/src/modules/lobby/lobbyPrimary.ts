import type { Worker } from 'node:cluster'
import type { LobbySnapshot } from '@zeepkist/core'
import { config } from '../../config'
import { LobbyCollector } from './lobbyCollector'
import { sendLobbySnapshot } from './lobbyIpc'
import { unavailableLobbySnapshot } from './lobbyStore'
import { startRoomBroker } from './roomBroker'

export async function startLobbyPrimary(getWorkers: () => Worker[]) {
	let snapshot: LobbySnapshot = unavailableLobbySnapshot
	const publish = (next: LobbySnapshot) => {
		snapshot = next
		for (const worker of getWorkers()) {
			sendLobbySnapshot(worker, snapshot)
		}
	}

	if (!config.lobby.enabled) {
		return { getSnapshot: () => snapshot, stop: async () => {} }
	}
	if (!config.lobby.host || !config.lobby.build || !config.lobby.port) {
		throw new Error('Enabled lobby collector has incomplete configuration')
	}
	const { closeDatabase, persistLobbyPacket } = await import('@zeepkist/database')
	const collector = new LobbyCollector(
		{
			appId: config.steamAppId,
			credentialRefreshMs: config.lobby.broker.credentialRefreshMs,
			host: config.lobby.host,
			port: config.lobby.port,
			build: config.lobby.build,
			refreshTokenFile: config.lobby.refreshTokenFile,
			room: config.lobby.broker.room,
		},
		publish,
		persistLobbyPacket,
	)
	collector.start()
	const broker = config.lobby.broker.enabled
		? startRoomBroker(
				{
					host: config.lobby.broker.host,
					port: config.lobby.broker.port,
					token: config.lobby.broker.token as string,
				},
				collector,
			)
		: undefined
	return {
		getSnapshot: () => snapshot,
		stop: async () => {
			try {
				await broker?.stop()
				await collector.stop()
			} finally {
				await closeDatabase()
			}
		},
	}
}
