import { describe, expect, mock, test } from 'bun:test'
import type { LobbyPacket } from '@zeepkist/core/zeepnet'
import { LobbyPersistenceQueue } from './lobbyPersistenceQueue'

const statisticsPacket = (onlinePlayers: number): LobbyPacket => ({
	type: 'statistics',
	onlinePlayers,
	lobbyCount: 1,
	playersInLobbies: 1,
})

describe('LobbyPersistenceQueue', () => {
	test('persists packets in arrival order', async () => {
		const completed: number[] = []
		const release: Array<() => void> = []
		let secondStarted: () => void = () => {}
		const secondStartedPromise = new Promise<void>((resolve) => {
			secondStarted = resolve
		})
		const persist = mock(async (packet: LobbyPacket) => {
			if (packet.type !== 'statistics') return
			if (packet.onlinePlayers === 2) secondStarted()
			await new Promise<void>((resolve) => release.push(resolve))
			completed.push(packet.onlinePlayers)
		})
		const onError = mock(() => {})
		const queue = new LobbyPersistenceQueue(persist, onError)

		queue.enqueue(statisticsPacket(1), '2026-08-21T00:00:00.000Z')
		queue.enqueue(statisticsPacket(2), '2026-08-21T00:00:01.000Z')
		await Promise.resolve()

		expect(persist).toHaveBeenCalledTimes(1)
		release[0]?.()
		await secondStartedPromise
		expect(persist).toHaveBeenCalledTimes(2)
		release[1]?.()
		await queue.drain()

		expect(completed).toEqual([1, 2])
		expect(onError).not.toHaveBeenCalled()
	})

	test('drops failed writes and continues', async () => {
		const completed: number[] = []
		const persist = mock(async (packet: LobbyPacket) => {
			if (packet.type !== 'statistics') return
			if (packet.onlinePlayers === 1) throw new Error('contains private packet values')
			completed.push(packet.onlinePlayers)
		})
		const onError = mock(() => {})
		const queue = new LobbyPersistenceQueue(persist, onError)

		queue.enqueue(statisticsPacket(1), '2026-08-21T00:00:00.000Z')
		queue.enqueue(statisticsPacket(2), '2026-08-21T00:00:01.000Z')
		await queue.drain()

		expect(onError).toHaveBeenCalledTimes(1)
		expect(onError).toHaveBeenCalledWith()
		expect(completed).toEqual([2])
	})
})
