import { expect, mock, spyOn, test } from 'bun:test'
import {
	createFeedClient,
	createFeedEvent,
	createFeedGuild,
	createFeedGuildState,
	tournamentData,
} from '../test/feed-mocks'
import { createMockContext } from '../test/mocks'
import { FeedService } from './feeds'
import type { FeedScheduler } from './feeds/feed-scheduler'

test('FeedService opens one activity subscription, schedules only tournaments, and stops resources', async () => {
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
	let liveEvents: ((events: ReturnType<typeof createFeedEvent>[]) => void) | undefined
	const unsubscribe = mock(() => {})
	const subscribeToActivityEvents = mock(
		(onEvents: (events: ReturnType<typeof createFeedEvent>[]) => void) => {
			liveEvents = onEvents
			return { unsubscribe }
		},
	)
	const { context, graphql } = createMockContext({
		graphql: {
			query: mock(async () => tournamentData),
			subscribeToActivityEvents,
		},
	})
	const { client } = createFeedClient()
	const service = new FeedService(client, context, scheduler as unknown as FeedScheduler)
	service.start()
	expect(intervals).toEqual([60_000])
	expect(subscribeToActivityEvents).toHaveBeenCalledTimes(1)
	expect(liveEvents).toBeDefined()
	callbacks[0]?.()
	await new Promise((resolve) => setTimeout(resolve, 0))
	expect(graphql.query).toHaveBeenCalled()
	service.stop()
	expect(clearIntervalMock).toHaveBeenCalledTimes(1)
	expect(unsubscribe).toHaveBeenCalledTimes(1)
})

test('FeedService serializes websocket batches without dropping events', async () => {
	let release: (() => void) | undefined
	let calls = 0
	const blocked = new Promise<void>((resolve) => {
		release = resolve
	})
	const workerCursor = mock(async () => {
		calls++
		if (calls === 1) await blocked
		return { cursorEventId: '0' }
	})
	const { context } = createMockContext({ backend: { workerCursor } })
	const { client } = createFeedClient()
	const service = new FeedService(client, context)
	const first = service.enqueueActivityEvents([
		createFeedEvent({ id: '1', kind: 'personal_best' }),
	])
	const second = service.enqueueActivityEvents([
		createFeedEvent({ id: '2', kind: 'personal_best' }),
	])
	await new Promise((resolve) => setTimeout(resolve, 0))
	expect(workerCursor).toHaveBeenCalledTimes(1)
	release?.()
	await Promise.all([first, second])
	expect(workerCursor).toHaveBeenCalledTimes(2)
})

test('FeedService contains activity watch, feed lookup, and tournament failures', async () => {
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
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
			enabledGuildFeeds: mock(async () => Promise.reject(new Error('feed lookup failed'))),
		},
		graphql: { query: mock(async () => Promise.reject(tournamentError)) },
	})
	const { client } = createFeedClient()
	const service = new FeedService(client, context)
	await service.processActivityEvents([createFeedEvent()])
	await service.pollTournaments()
	expect(consoleError).toHaveBeenCalledWith('Discord activity watch processing failed', {
		message: 'watch failed',
		name: 'Error',
	})
	expect(consoleError).toHaveBeenCalledWith('Discord activity feed lookup failed', {
		message: 'feed lookup failed',
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

test('FeedService fans websocket events out through one enabled-feed lookup', async () => {
	const workshopGuild = createFeedGuild()
	const worldRecordGuild = createFeedGuild()
	;(worldRecordGuild.guild as unknown as { id: string }).id = 'guild-2'
	const { backend, context } = createMockContext({
		backend: {
			enabledGuildFeeds: mock(async () => [
				{
					guildId: 'guild-1',
					kind: 'workshop',
					channelId: 'channel',
					enabled: true,
					cursorEventId: '0',
				},
				{
					guildId: 'guild-2',
					kind: 'world_record',
					channelId: 'channel',
					enabled: true,
					cursorEventId: '0',
				},
				{
					guildId: 'guild-1',
					kind: 'totw',
					channelId: 'channel',
					enabled: true,
					cursorEventId: '0',
				},
			]),
			delivery: mock(async () => null),
		},
	})
	const { client } = createFeedClient([workshopGuild.guild, worldRecordGuild.guild])
	await new FeedService(client, context).processActivityEvents([
		createFeedEvent({ id: '1', kind: 'workshop' }),
		createFeedEvent({ id: '2', kind: 'world_record' }),
	])
	expect(backend.enabledGuildFeeds).toHaveBeenCalledTimes(1)
	expect(backend.guild).not.toHaveBeenCalled()
	expect(workshopGuild.send).toHaveBeenCalledTimes(1)
	expect(worldRecordGuild.send).toHaveBeenCalledTimes(1)
	expect(backend.advanceFeed.mock.calls.map((call) => call.slice(0, 3))).toEqual([
		['guild-1', 'workshop', '1'],
		['guild-2', 'world_record', '2'],
	])
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
