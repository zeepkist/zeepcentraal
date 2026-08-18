import type { LobbySnapshot } from '@zeepkist/core'
import { onMounted, onScopeDispose, readonly, shallowRef, watch } from 'vue'

export async function useLobbyFeed() {
	const config = useRuntimeConfig()
	const baseUrl = config.public.backendUrl.replace(/\/$/, '')
	const snapshot = shallowRef<LobbySnapshot | null>(null)
	const streamConnected = shallowRef(false)
	const result = await useFetch<LobbySnapshot>(`${baseUrl}/lobby`, {
		key: 'lobby-snapshot',
	})

	watch(
		result.data,
		(value) => {
			if (value && isLobbySnapshot(value)) snapshot.value = value
		},
		{ immediate: true },
	)

	let events: EventSource | undefined
	onMounted(() => {
		events = new EventSource(`${baseUrl}/lobby/events`)
		events.addEventListener('open', () => {
			streamConnected.value = true
		})
		events.addEventListener('error', () => {
			streamConnected.value = false
		})
		events.addEventListener('snapshot', (event) => {
			if (!(event instanceof MessageEvent)) return
			try {
				const value: unknown = JSON.parse(event.data)
				if (isLobbySnapshot(value)) snapshot.value = value
			} catch {
				// Ignore malformed events. EventSource keeps last valid snapshot and reconnects.
			}
		})
	})

	onScopeDispose(() => events?.close())

	return {
		snapshot: readonly(snapshot),
		streamConnected: readonly(streamConnected),
		pending: result.pending,
		error: result.error,
		refresh: result.refresh,
	}
}

export function isLobbySnapshot(value: unknown): value is LobbySnapshot {
	if (
		!isObject(value) ||
		!['connecting', 'live', 'stale', 'unavailable'].includes(String(value.status))
	) {
		return false
	}
	if (!isObject(value.stats) || !Array.isArray(value.lobbies)) return false
	if (
		!isNullableNumber(value.stats.onlinePlayers) ||
		!isNullableNumber(value.stats.lobbyCount) ||
		!isNullableNumber(value.stats.playersInLobbies) ||
		!isNullableString(value.updatedAt) ||
		!isNullableString(value.staleSince)
	) {
		return false
	}
	return value.lobbies.every(
		(lobby) =>
			isObject(lobby) &&
			typeof lobby.title === 'string' &&
			typeof lobby.isPublic === 'boolean' &&
			isObject(lobby.host) &&
			typeof lobby.host.name === 'string' &&
			typeof lobby.host.steamId === 'string' &&
			typeof lobby.players === 'number' &&
			typeof lobby.playerLimit === 'number',
	)
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null
}

function isNullableNumber(value: unknown) {
	return value === null || typeof value === 'number'
}

function isNullableString(value: unknown) {
	return value === null || typeof value === 'string'
}
