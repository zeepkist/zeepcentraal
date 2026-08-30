import { expect, test } from 'bun:test'
import type { LobbySnapshot } from '@zeepkist/core'
import { LobbyCollector } from './lobbyCollector'
import type { LobbySteamSession, SteamIdentity } from './steamSession'

test('recreates Steam session after initial logon failure', async () => {
	let attempts = 0
	let secondAttemptResolve: (() => void) | undefined
	const secondAttempt = new Promise<void>((resolve) => {
		secondAttemptResolve = resolve
	})
	const snapshots: LobbySnapshot[] = []
	const collector = new LobbyCollector(
		{
			appId: 1_440_670,
			build: 2043,
			credentialRefreshMs: 3_000_000,
			host: '127.0.0.1',
			port: 26900,
			refreshTokenFile: 'unused',
			room: { isPublic: true, maxPlayers: 64, name: 'Room' },
		},
		(snapshot) => snapshots.push(snapshot),
		async () => {},
		() =>
			({
				close: () => {},
				connect: async () => {
					attempts++
					if (attempts === 1) throw new Error('Logon failed')
					secondAttemptResolve?.()
					return await new Promise<SteamIdentity>(() => {})
				},
			}) as LobbySteamSession,
	)

	collector.start()
	await withTimeout(secondAttempt)
	await collector.stop()

	expect(attempts).toBe(2)
	expect(snapshots.some((snapshot) => snapshot.status === 'unavailable')).toBe(true)
})

test('recreates Steam session when encrypted app ticket becomes unavailable', async () => {
	let sessions = 0
	let secondSessionResolve: (() => void) | undefined
	const secondSession = new Promise<void>((resolve) => {
		secondSessionResolve = resolve
	})
	const collector = new LobbyCollector(
		{
			appId: 1_440_670,
			build: 2043,
			credentialRefreshMs: 3_000_000,
			host: '127.0.0.1',
			port: 26900,
			refreshTokenFile: 'unused',
			room: { isPublic: true, maxPlayers: 64, name: 'Room' },
		},
		() => {},
		async () => {},
		() => {
			sessions++
			const session = sessions
			return {
				close: () => {},
				connect: async () => {
					if (session === 2) {
						secondSessionResolve?.()
						return await new Promise<SteamIdentity>(() => {})
					}
					return identity()
				},
				createEncryptedAppTicket: async () => {
					throw new Error('Steam session expired')
				},
			} as unknown as LobbySteamSession
		},
	)

	collector.start()
	await withTimeout(secondSession)
	await collector.stop()

	expect(sessions).toBe(2)
})

function identity(): SteamIdentity {
	return { name: 'Host', steamId: 76561198000000000n }
}

function withTimeout<T>(promise: Promise<T>) {
	return Promise.race([
		promise,
		new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Test timed out')), 2_000),
		),
	])
}
