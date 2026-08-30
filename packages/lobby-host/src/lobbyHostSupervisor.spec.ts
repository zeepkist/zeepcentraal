import { expect, mock, test } from 'bun:test'
import type { ManagedRoomConfig } from '@zeepkist/core/config/lobby-host'

mock.module('./managedLobbyHost', () => ({
	ManagedLobbyHost: class {},
}))

const { LobbyHostSupervisor } = await import('./lobbyHostSupervisor')

test('runs rooms concurrently and closes shared leaderboard once', async () => {
	const runs: string[] = []
	const stops: string[] = []
	const runResolvers = new Map<string, () => void>()
	const close = mock(async () => {})
	const supervisor = new LobbyHostSupervisor(config(), {
		broker: {} as never,
		leaderboard: { close } as never,
		payloads: {} as never,
		createHost: (room) => ({
			run: () =>
				new Promise<void>((resolve) => {
					runs.push(room.key)
					runResolvers.set(room.key, resolve)
				}),
			stop: async () => {
				stops.push(room.key)
				runResolvers.get(room.key)?.()
			},
		}),
	})
	const running = supervisor.run()
	await Bun.sleep(0)
	expect(runs.toSorted()).toEqual(['totm', 'totw'])
	await supervisor.stop()
	await running
	expect(stops.toSorted()).toEqual(['totm', 'totw'])
	expect(close).toHaveBeenCalledTimes(1)
})

test('restarts one failed room without stopping sibling', async () => {
	let totwRuns = 0
	let resolveTotw: (() => void) | undefined
	let resolveTotm: (() => void) | undefined
	const supervisor = new LobbyHostSupervisor(config(), {
		broker: {} as never,
		leaderboard: { close: async () => {} } as never,
		payloads: {} as never,
		restartDelayMs: 1,
		createHost: (room) => ({
			run: () => {
				if (room.key === 'totw' && totwRuns++ === 0)
					return Promise.reject(new Error('failed'))
				return new Promise<void>((resolve) => {
					if (room.key === 'totw') resolveTotw = resolve
					else resolveTotm = resolve
				})
			},
			stop: async () => {
				if (room.key === 'totw') resolveTotw?.()
				else resolveTotm?.()
			},
		}),
	})
	const running = supervisor.run()
	await Bun.sleep(10)
	expect(totwRuns).toBe(2)
	await supervisor.stop()
	await running
})

function config() {
	return {
		brokerToken: 'x'.repeat(32),
		brokerUrl: 'http://localhost:3001',
		graphqlWsUrl: 'ws://localhost:5000',
		file: {
			version: 1 as const,
			rooms: [room('totw', 'weekly'), room('totm', 'monthly')],
		},
	}
}

function room(key: string, tournamentType: 'monthly' | 'weekly'): ManagedRoomConfig {
	return {
		key,
		profile: { type: 'track-tournament', tournamentType },
		room: { name: key, isPublic: true, maxPlayers: 64 },
		roundTimeSeconds: 900,
		assetPollMs: 30_000,
		reconnectMaxMs: 60_000,
		messageRefreshMs: 60_000,
	}
}
