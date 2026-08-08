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
	const tournamentError = Object.assign(new Error('[GraphQL] timeout exceeded'), {
		name: 'CombinedError',
		response: new Response(null, {
			headers: { 'x-query-cost': '162' },
			status: 524,
		}),
	})
	const { context } = createMockContext({
		backend: {
			workerCursor: mock(async () => Promise.reject(new Error('watch failed'))),
			guild: mock(async () => Promise.reject(new Error('guild failed'))),
		},
		graphql: { query: mock(async () => Promise.reject(tournamentError)) },
	})
	const { client } = createFeedClient([guild])
	const service = new FeedService(client, context)
	await service.pollActivity()
	await service.pollTournaments()
	expect(consoleError).toHaveBeenCalledWith('Discord activity watch poll failed', {
		message: 'watch failed',
		name: 'Error',
	})
	expect(consoleError).toHaveBeenCalledWith('Discord activity feed poll failed', {
		message: 'guild failed',
		name: 'Error',
	})
	expect(consoleError).toHaveBeenCalledWith('Discord tournament feed poll failed', {
		message: '[GraphQL] timeout exceeded',
		name: 'CombinedError',
		queryCost: '162',
		status: 524,
	})
	consoleError.mockRestore()
})

test('FeedService logs guild and channel context for tournament update failures', async () => {
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	const failedGuild = createFeedGuild()
	failedGuild.send.mockImplementation(async () => {
		throw new Error('Missing Permissions')
	})
	const healthyGuild = createFeedGuild()
	;(healthyGuild.guild as unknown as { id: string; name: string }).id = 'guild-2'
	;(healthyGuild.guild as unknown as { id: string; name: string }).name = 'Healthy Guild'
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
	const { client } = createFeedClient([failedGuild.guild, healthyGuild.guild])
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
		{ message: 'Missing Permissions', name: 'Error' },
	)
	expect(healthyGuild.send).toHaveBeenCalledTimes(1)
	consoleError.mockRestore()
})

test('FeedService batches tournament snapshots across guilds without update queries', async () => {
	const firstGuild = createFeedGuild()
	const secondGuild = createFeedGuild()
	;(secondGuild.guild as unknown as { id: string }).id = 'guild-2'
	const query = mock(async () => tournamentData)
	const usersByIds = mock(async () => new Map())
	const { context, backend } = createMockContext({
		backend: {
			guild: mock(async () =>
				createFeedGuildState({
					feeds: [
						{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' },
					],
				}),
			),
		},
		graphql: { query, usersByIds },
	})
	const { client } = createFeedClient([firstGuild.guild, secondGuild.guild])
	await new FeedService(client, context).pollTournaments()
	expect(query).toHaveBeenCalledTimes(1)
	expect(usersByIds).toHaveBeenCalledTimes(1)
	expect(backend.guild).toHaveBeenCalledTimes(2)
	expect(backend.setTournamentMessage).toHaveBeenCalledTimes(2)
})

test('FeedService suppresses overlapping tournament polls', async () => {
	let release: (() => void) | undefined
	const blocked = new Promise<void>((resolve) => {
		release = resolve
	})
	const query = mock(async () => {
		await blocked
		return tournamentData
	})
	const { context } = createMockContext({ graphql: { query } })
	const { client } = createFeedClient()
	const service = new FeedService(client, context)
	const first = service.pollTournaments()
	await service.pollTournaments()
	expect(query).toHaveBeenCalledTimes(1)
	release?.()
	await first
})

test('FeedService warns for missing tournament type and continues available type', async () => {
	const consoleWarn = spyOn(console, 'warn').mockImplementation(() => {})
	const guild = createFeedGuild()
	const { context, backend } = createMockContext({
		backend: {
			guild: mock(async () =>
				createFeedGuildState({
					feeds: [
						{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' },
					],
				}),
			),
		},
		graphql: {
			query: mock(async () => ({ ...tournamentData, monthly: { nodes: [] } })),
		},
	})
	const { client } = createFeedClient([guild.guild])
	await new FeedService(client, context).pollTournaments()
	expect(consoleWarn).toHaveBeenCalledWith('Discord tournament snapshot missing', {
		feedKind: 'totm',
	})
	expect(backend.setTournamentMessage).toHaveBeenCalledTimes(1)
	consoleWarn.mockRestore()
})

test('FeedService isolates tournament watch failures from other types and guild feeds', async () => {
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	const guild = createFeedGuild()
	let matchCount = 0
	const matchingWatches = mock(async () => {
		matchCount++
		if (matchCount === 1) throw new Error('watch backend failed')
		return []
	})
	const { context, backend } = createMockContext({
		backend: {
			matchingWatches,
			guild: mock(async () =>
				createFeedGuildState({
					feeds: [
						{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' },
						{ kind: 'totm', channelId: 'channel', enabled: true, cursorEventId: '0' },
					],
				}),
			),
		},
		graphql: { query: mock(async () => tournamentData) },
	})
	const { client } = createFeedClient([guild.guild])
	await new FeedService(client, context).pollTournaments()
	expect(matchingWatches).toHaveBeenCalledTimes(2)
	expect(backend.setTournamentMessage).toHaveBeenCalledTimes(2)
	expect(consoleError).toHaveBeenCalledWith(
		'Discord tournament watch delivery failed',
		{ feedKind: 'totw' },
		{ message: 'watch backend failed', name: 'Error' },
	)
	consoleError.mockRestore()
})
