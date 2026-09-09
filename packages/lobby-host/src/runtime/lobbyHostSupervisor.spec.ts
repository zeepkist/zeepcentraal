import { expect, mock, test } from 'bun:test'
import { LobbyHostSupervisor } from './lobbyHostSupervisor'

test('runs rooms concurrently and closes shared resources once after all rooms stop', async () => {
	const runs: string[] = []
	const stops: string[] = []
	const resolvers = new Map<string, () => void>()
	const close = mock(async () => {
		expect(stops.toSorted()).toEqual(['totm', 'totw'])
	})
	const supervisor = new LobbyHostSupervisor(
		['totw', 'totm'].map((key) => ({
			key,
			host: {
				run: () =>
					new Promise<void>((resolve) => {
						runs.push(key)
						resolvers.set(key, resolve)
					}),
				stop: async () => {
					stops.push(key)
					resolvers.get(key)?.()
				},
			},
		})),
		close,
	)
	const running = supervisor.run()
	await Bun.sleep(0)
	expect(runs.toSorted()).toEqual(['totm', 'totw'])
	await Promise.all([supervisor.stop(), supervisor.stop()])
	await running
	expect(close).toHaveBeenCalledTimes(1)
})

test('restarts failed room without resetting sibling', async () => {
	let attempts = 0
	const resolvers: (() => void)[] = []
	let siblingRuns = 0
	const supervisor = new LobbyHostSupervisor(
		['one', 'two'].map((key) => ({
			key,
			host: {
				run: async () => {
					if (key === 'one' && attempts++ === 0) throw new Error('failed')
					if (key === 'two') siblingRuns++
					await new Promise<void>((resolve) => resolvers.push(resolve))
				},
				stop: async () => {
					for (const resolve of resolvers) resolve()
				},
			},
		})),
		async () => {},
		1,
	)
	const running = supervisor.run()
	await Bun.sleep(20)
	expect(attempts).toBe(2)
	expect(siblingRuns).toBe(1)
	await supervisor.stop()
	await running
})

test('closes shared resources even if a room fails to stop', async () => {
	const close = mock(async () => {})
	const siblingStop = mock(async () => {})
	const supervisor = new LobbyHostSupervisor(
		[
			{
				key: 'one',
				host: {
					run: async () => {},
					stop: async () => {
						throw new Error('stop failed')
					},
				},
			},
			{ key: 'two', host: { run: async () => {}, stop: siblingStop } },
		],
		close,
	)
	await expect(supervisor.stop()).rejects.toThrow('stop failed')
	expect(close).toHaveBeenCalledTimes(1)
	expect(siblingStop).toHaveBeenCalledTimes(1)
})
