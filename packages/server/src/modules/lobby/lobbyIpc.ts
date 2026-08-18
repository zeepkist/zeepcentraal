import type { Worker } from 'node:cluster'
import type { LobbySnapshot } from '@zeepkist/core'
import { lobbySnapshotStore } from './lobbyStore'

type WorkerLobbyMessage = { type: 'lobby:ready' }
type PrimaryLobbyMessage = { type: 'lobby:snapshot'; snapshot: LobbySnapshot }

export function initializeLobbyWorkerIpc() {
	process.on('message', (message: unknown) => {
		if (isPrimaryLobbyMessage(message)) {
			lobbySnapshotStore.set(message.snapshot)
		}
	})
	process.send?.({ type: 'lobby:ready' } satisfies WorkerLobbyMessage)
}

export function attachLobbyWorker(worker: Worker, getSnapshot: () => LobbySnapshot) {
	worker.on('message', (message: unknown) => {
		if (isWorkerLobbyMessage(message)) {
			worker.send({
				type: 'lobby:snapshot',
				snapshot: getSnapshot(),
			} satisfies PrimaryLobbyMessage)
		}
	})
}

export function sendLobbySnapshot(worker: Worker, snapshot: LobbySnapshot) {
	if (worker.isConnected()) {
		worker.send({ type: 'lobby:snapshot', snapshot } satisfies PrimaryLobbyMessage)
	}
}

function isWorkerLobbyMessage(message: unknown): message is WorkerLobbyMessage {
	return isObject(message) && message.type === 'lobby:ready'
}

function isPrimaryLobbyMessage(message: unknown): message is PrimaryLobbyMessage {
	return isObject(message) && message.type === 'lobby:snapshot' && isObject(message.snapshot)
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}
