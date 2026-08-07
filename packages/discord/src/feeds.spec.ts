import { expect, mock, spyOn, test } from 'bun:test'
import {
	createFeedClient,
	createFeedGuild,
	createFeedGuildState,
	tournamentData,
} from '../test/feed-mocks'
import { createMockContext } from '../test/mocks'
import { FeedService } from './feeds'
import type { FeedScheduler } from './feeds/feed-scheduler'

test('FeedService schedules, polls, avoids overlapping activity work, and stops resources', async () => {
	const clearIntervalMock = mock(() => {})
	const callbacks: Array<() => void> = []
	const intervals: number[] = []
	const scheduler = {
		setInterval: mock((callback: () => void, interval: number) => {
			callbacks.push(callback)
			intervals.push(interval)
			return callbacks.length as unknown as ReturnType<typeof setInterval>
		}),
		clearInterval: clearIntervalMock as typeof clearInterval,
	}
	let release: (() => void) | undefined
	let liveChange: (() => void) | undefined
	const blocked = new Promise<void>((resolve) => {
		release = resolve
	})
	const workerCursor = mock(async () => {
		await blocked
		return { cursorEventId: '0' }
	})
	const unsubscribe = mock(() => {})
	const restartLiveConnection = mock(() => {})
	const { context } = createMockContext({
		backend: { workerCursor },
		graphql: {
			query: mock(async () => tournamentData),
			restartLiveConnection,
			subscribeToActivityEvents: mock((onChange: () => void) => {
				liveChange = onChange
				return { unsubscribe }
			}),
		},
	})
	const { client } = createFeedClient()
	const service = new FeedService(client, context, scheduler as unknown as FeedScheduler)
	service.start()
	expect(intervals).toEqual([20_000, 60_000, 55 * 60_000])
	liveChange?.()
	const first = service.pollActivity()
	await service.pollActivity()
	expect(workerCursor).toHaveBeenCalledTimes(1)
	release?.()
	await first
	callbacks[0]?.()
	callbacks[1]?.()
	callbacks[2]?.()
	await new Promise((resolve) => setTimeout(resolve, 0))
	expect(restartLiveConnection).toHaveBeenCalledTimes(1)
	service.stop()
	expect(clearIntervalMock).toHaveBeenCalledTimes(3)
	expect(unsubscribe).toHaveBeenCalledTimes(1)
})

test('FeedService contains activity, watch, guild, and tournament failures', async () => {
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	const guild = createFeedGuild().guild
	const { context } = createMockContext({
		backend: {
			workerCursor: mock(async () => Promise.reject(new Error('watch failed'))),
			guild: mock(async () => Promise.reject(new Error('guild failed'))),
		},
		graphql: { query: mock(async () => Promise.reject(new Error('tournament failed'))) },
	})
	const { client } = createFeedClient([guild])
	const service = new FeedService(client, context)
	await service.pollActivity()
	await service.pollTournaments()
	expect(consoleError).toHaveBeenCalledWith(
		'Discord activity watch poll failed',
		expect.any(Error),
	)
	expect(consoleError).toHaveBeenCalledWith(
		'Discord activity feed poll failed',
		expect.any(Error),
	)
	expect(consoleError).toHaveBeenCalledWith(
		'Discord tournament feed poll failed',
		expect.any(Error),
	)
	consoleError.mockRestore()
})

test('FeedService logs guild and channel context for tournament update failures', async () => {
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	const failedGuild = createFeedGuild()
	failedGuild.send.mockImplementation(async () => {
		throw new Error('Missing Permissions')
	})
	const { context } = createMockContext({
		backend: {
			guild: mock(async () =>
				createFeedGuildState({
					feeds: [
						{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' },
					],
				}),
			),
		},
		graphql: { query: mock(async () => tournamentData) },
	})
	const { client } = createFeedClient([failedGuild.guild])
	await new FeedService(client, context).pollTournaments()
	expect(consoleError).toHaveBeenCalledWith(
		'Discord tournament feed poll failed',
		{
			guildId: 'guild-1',
			guildName: 'Test Guild',
			channelId: 'channel',
			channelName: 'tournament-feed',
			feedKind: 'totw',
		},
		expect.any(Error),
	)
	consoleError.mockRestore()
})
