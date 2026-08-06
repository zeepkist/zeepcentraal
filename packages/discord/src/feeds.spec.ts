import { expect, mock, spyOn, test } from 'bun:test'
import type { Client, Guild, MessageCreateOptions } from 'discord.js'
import { createMockContext, linkedUser } from '../test/mocks'
import {
	aliases,
	createProductionFeedScheduler,
	deliverWatches,
	eventLevelName,
	eventMessage,
	eventWatchTargets,
	type FeedScheduler,
	FeedService,
	permanentDmFailure,
	processActivityWatches,
	processFeed,
	rankMessage,
	sendToChannel,
	updateTournament,
} from './feeds'
import type { DiscordActivityEvent, DiscordGuildState } from './types'

function createEvent(overrides: Partial<DiscordActivityEvent> = {}): DiscordActivityEvent {
	return {
		id: 'event-1',
		kind: 'world_record',
		levelId: 3,
		userId: 7,
		previousUserId: 8,
		recordId: 9,
		previousRecordId: 10,
		payload: {},
		occurredAt: '2026-08-06T12:00:00Z',
		level: {
			id: 3,
			xxHash: 'level-hash',
			levelItems: {
				nodes: [
					{
						name: 'Fast Track',
						imageUrl: 'https://image.test/level.jpg',
						workshopId: '123',
						author: linkedUser,
					},
				],
			},
			levelPoints: { points: 100, rating: 4.5 },
		},
		user: linkedUser,
		previousUser: { ...linkedUser, id: 8, steamName: 'Previous', discordId: 'discord-2' },
		record: { id: 9, time: 12.3, modVersion: '1.0' },
		previousRecord: { id: 10, time: 12.4, modVersion: '1.0' },
		...overrides,
	}
}

function guildState(overrides: Partial<DiscordGuildState> = {}): DiscordGuildState {
	return {
		config: null,
		feeds: [],
		digest: null,
		tournamentMessages: [],
		...overrides,
	}
}

function createGuild(options: { channel?: Record<string, unknown> | null } = {}) {
	const edit = mock(async () => {})
	const send = mock(async () => ({ id: 'message-new' }))
	const message = { id: 'message-old', edit }
	const channel =
		options.channel === undefined
			? {
					isTextBased: () => true,
					messages: { fetch: mock(async () => message) },
					send,
				}
			: options.channel
	const fetch = mock(async () => channel)
	const guild = { id: 'guild-1', channels: { fetch } } as unknown as Guild
	return { channel, edit, fetch, guild, message, send }
}

function createClient(guilds: Guild[] = [], send = mock(async () => ({}))) {
	const fetch = mock(async () => ({ send }))
	return {
		client: {
			guilds: { cache: new Map(guilds.map((guild) => [guild.id, guild])) },
			users: { fetch },
		} as unknown as Client,
		fetch,
		send,
	}
}

const tournamentData = {
	active: {
		nodes: [
			{
				id: 5,
				slug: 'week-5',
				endAt: '2026-08-08T00:00:00Z',
				trackTournamentResults: { totalCount: 0, nodes: [] },
			},
		],
	},
}

test('production feed scheduler exposes timer functions', () => {
	const scheduler = createProductionFeedScheduler()
	expect(typeof scheduler.setInterval).toBe('function')
	expect(typeof scheduler.clearInterval).toBe('function')
})

test('aliases and watch targets include linked identities, rank players, levels, and authors', () => {
	expect(aliases(null)).toEqual([])
	expect(aliases(linkedUser)).toEqual(['7', '76561198000000007', 'discord-1', 'Player Seven'])
	const targets = eventWatchTargets(
		createEvent({
			kind: 'rank_batch',
			payload: { changes: [{ idUser: 11 }, { idUser: '12' }, { idUser: null }] },
		}),
	)
	expect(targets[0]?.targetIds).toContain('11')
	expect(targets[1]?.targetIds).toEqual(['3', 'level-hash', 'Fast Track'])
	expect(targets[2]?.targetIds).toContain('Player Seven')
	expect(eventWatchTargets(createEvent({ level: null, payload: null }))[1]?.targetIds).toEqual([])
})

test('permanent DM failure recognizes Discord permission and unknown-user codes', () => {
	for (const code of [50007, 50013, 10013]) expect(permanentDmFailure({ code })).toBe(true)
	expect(permanentDmFailure({ code: 500 })).toBe(false)
	expect(permanentDmFailure(null)).toBe(false)
})

test('watch delivery groups recipients, skips delivered watches, and records success', async () => {
	const { backend, context } = createMockContext()
	const { client, fetch, send } = createClient()
	await deliverWatches(
		client,
		[
			{ id: 'a', discordId: 'discord-1', lastDeliveryKey: null },
			{ id: 'b', discordId: 'discord-1', lastDeliveryKey: null },
			{ id: 'c', discordId: 'discord-2', lastDeliveryKey: 'delivery' },
		] as never,
		'delivery',
		{ content: 'hello' },
		context,
	)
	expect(fetch).toHaveBeenCalledTimes(1)
	expect(send).toHaveBeenCalledWith(
		expect.objectContaining({ content: undefined, allowedMentions: { parse: [] } }),
	)
	expect(backend.updateWatchDelivery).toHaveBeenCalledTimes(2)
	expect(backend.updateWatchDelivery.mock.calls[0]).toEqual([
		'a',
		{ paused: false, lastError: null, deliveryKey: 'delivery' },
	])
})

test('watch delivery pauses permanent failures and rethrows transient failures', async () => {
	for (const [failure, paused] of [
		[Object.assign(new Error('closed'), { code: 50007 }), true],
	] as const) {
		const { backend, context } = createMockContext()
		const { client } = createClient(
			[],
			mock(async () => Promise.reject(failure)),
		)
		await deliverWatches(
			client,
			[{ id: 'a', discordId: 'discord-1', lastDeliveryKey: null }] as never,
			'delivery',
			{},
			context,
		)
		expect(backend.updateWatchDelivery).toHaveBeenCalledWith('a', {
			paused,
			lastError: 'closed',
			deliveryKey: null,
		})
	}
	const { backend, context } = createMockContext()
	const { client } = createClient(
		[],
		mock(async () => Promise.reject('temporary')),
	)
	await expect(
		deliverWatches(
			client,
			[{ id: 'b', discordId: 'discord-2', lastDeliveryKey: null }] as never,
			'delivery',
			{},
			context,
		),
	).rejects.toBe('temporary')
	expect(backend.updateWatchDelivery).toHaveBeenCalledWith('b', {
		paused: false,
		lastError: 'temporary',
		deliveryKey: null,
	})
})

test('event helpers render level fallbacks and rank directions', async () => {
	expect(eventLevelName(createEvent())).toBe('Fast Track')
	expect(eventLevelName(createEvent({ level: null, payload: { name: 'Payload track' } }))).toBe(
		'Payload track',
	)
	expect(eventLevelName(createEvent({ level: null, payload: null }))).toBe('Unknown level')
	const { context } = createMockContext({
		graphql: {
			usersByIds: mock(
				async () =>
					new Map([
						[7, linkedUser],
						[8, { ...linkedUser, id: 8, steamName: 'Eight' }],
					]),
			),
		},
	})
	const ranked = await rankMessage(
		createEvent({
			kind: 'rank_batch',
			payload: {
				changes: [
					{ idUser: 7, previousRank: 4, rank: 2 },
					{ idUser: 8, previousRank: 2, rank: 5 },
				],
			},
		}),
		context,
	)
	expect(JSON.stringify(ranked)).toContain('▲')
	expect(JSON.stringify(ranked)).toContain('▼')
	expect(JSON.stringify(await rankMessage(createEvent({ payload: null }), context))).toContain(
		'Ranking recalculated.',
	)
})

test('event messages cover workshop, personal best, vote, and world-record ping policy', async () => {
	const { context } = createMockContext({
		backend: {
			user: mock(async () => ({
				linkedUser,
				preference: { pingOnWorldRecordLoss: true },
				watches: [],
			})),
		},
	})
	const workshop = await eventMessage(createEvent({ kind: 'workshop' }), context)
	expect(JSON.stringify(workshop)).toContain('New public workshop level')
	expect(JSON.stringify(workshop)).toContain('https://image.test/level.jpg')
	const workshopFallback = await eventMessage(
		createEvent({ kind: 'workshop', level: null, payload: { workshopId: '999' } }),
		context,
	)
	expect(JSON.stringify(workshopFallback)).toContain('999')
	expect(
		JSON.stringify(await eventMessage(createEvent({ kind: 'personal_best' }), context)),
	).toContain('New personal best')
	expect(
		JSON.stringify(
			await eventMessage(createEvent({ kind: 'vote', payload: { value: 1 } }), context),
		),
	).toContain('voted 1')
	const worldRecord = (await eventMessage(createEvent(), context)) as MessageCreateOptions
	expect(worldRecord.content).toContain('<@discord-2>')
	expect(worldRecord.allowedMentions).toEqual({ users: ['discord-2'], parse: [] })
	const noPrevious = (await eventMessage(
		createEvent({ previousUser: null, previousRecord: null }),
		context,
	)) as MessageCreateOptions
	expect(noPrevious.content).toBeUndefined()
	const failedPreference = createMockContext({
		backend: { user: mock(async () => Promise.reject(new Error('backend offline'))) },
	}).context
	expect(
		((await eventMessage(createEvent(), failedPreference)) as MessageCreateOptions).content,
	).toBeUndefined()
})

test('sendToChannel rejects unavailable channels and sends to text channels', async () => {
	const valid = createGuild()
	expect(await sendToChannel(valid.guild, 'channel', { content: 'hi' })).toEqual({
		id: 'message-new',
	})
	expect(valid.send).toHaveBeenCalledWith({ content: 'hi' })
	for (const channel of [null, { isTextBased: () => false }, { isTextBased: () => true }]) {
		const invalid = createGuild({ channel })
		await expect(sendToChannel(invalid.guild, 'channel', {})).rejects.toThrow(
			'Configured channel is unavailable',
		)
	}
})

test('processFeed skips disabled/tournament feeds and advances unrelated events', async () => {
	const { guild } = createGuild()
	const { backend, context, graphql } = createMockContext({
		graphql: { activityEvents: mock(async () => [createEvent({ kind: 'vote' })]) },
	})
	await processFeed(guild, guildState(), 'workshop', context)
	await processFeed(
		guild,
		guildState({
			feeds: [{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' }],
		}),
		'totw',
		context,
	)
	expect(graphql.activityEvents).not.toHaveBeenCalled()
	await processFeed(
		guild,
		guildState({
			feeds: [{ kind: 'workshop', channelId: 'channel', enabled: true, cursorEventId: '0' }],
		}),
		'workshop',
		context,
	)
	expect(backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'workshop', 'event-1')
})

test('processFeed sends idempotently, resumes sent deliveries, and records failures', async () => {
	const state = guildState({
		feeds: [{ kind: 'world_record', channelId: 'channel', enabled: true, cursorEventId: '0' }],
	})
	const sentGuild = createGuild()
	const success = createMockContext({
		backend: { delivery: mock(async () => null) },
		graphql: { activityEvents: mock(async () => [createEvent()]) },
	})
	await processFeed(sentGuild.guild, state, 'world_record', success.context)
	expect(success.backend.setDelivery).toHaveBeenCalledTimes(2)
	expect(success.backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'world_record', 'event-1')

	const resumed = createMockContext({
		backend: { delivery: mock(async () => ({ status: 'sent' })) },
		graphql: { activityEvents: mock(async () => [createEvent()]) },
	})
	await processFeed(sentGuild.guild, state, 'world_record', resumed.context)
	expect(sentGuild.send).toHaveBeenCalledTimes(1)
	expect(resumed.backend.advanceFeed).toHaveBeenCalledTimes(1)

	const failedGuild = createGuild({ channel: null })
	const failed = createMockContext({
		backend: { delivery: mock(async () => null) },
		graphql: { activityEvents: mock(async () => [createEvent()]) },
	})
	await expect(
		processFeed(failedGuild.guild, state, 'world_record', failed.context),
	).rejects.toThrow('Configured channel is unavailable')
	expect(failed.backend.setDelivery.mock.calls.at(-1)?.[0]).toMatchObject({
		status: 'failed',
		lastError: 'Configured channel is unavailable',
	})
})

test('activity watch processor delivers matching events and always advances cursor', async () => {
	const event = createEvent()
	const { client, send } = createClient()
	const { backend, context } = createMockContext({
		backend: {
			workerCursor: mock(async () => ({ cursorEventId: '4' })),
			matchingWatches: mock(async () => [
				{ id: 'watch', discordId: 'discord-1', lastDeliveryKey: null },
			]),
		},
		graphql: { activityEvents: mock(async () => [event]) },
	})
	await processActivityWatches(client, context)
	expect(send).toHaveBeenCalledTimes(1)
	expect(backend.advanceWorkerCursor).toHaveBeenCalledWith('watch-events', 'event-1')
	backend.matchingWatches.mockImplementation(async () => [])
	await processActivityWatches(client, context)
	expect(send).toHaveBeenCalledTimes(1)
})

test('tournament updates create, edit, skip stable, and reject invalid channels', async () => {
	const baseState = guildState({
		feeds: [{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' }],
	})
	const { context, backend } = createMockContext({
		graphql: { query: mock(async () => tournamentData) },
	})
	const created = createGuild()
	await updateTournament(created.guild, baseState, 0, context)
	expect(created.send).toHaveBeenCalledTimes(1)
	expect(backend.setTournamentMessage).toHaveBeenCalledWith(
		expect.objectContaining({ tournamentId: 5, messageId: 'message-new' }),
	)
	const saved = backend.setTournamentMessage.mock.calls[0]?.[0] as { contentHash: string }
	await updateTournament(
		created.guild,
		guildState({
			...baseState,
			tournamentMessages: [
				{ idTournament: 5, channelId: 'channel', messageId: 'message-old', ...saved },
			],
		}),
		0,
		context,
	)
	expect(created.send).toHaveBeenCalledTimes(1)
	const changed = guildState({
		...baseState,
		tournamentMessages: [
			{ idTournament: 5, channelId: 'channel', messageId: 'message-old', contentHash: 'old' },
		],
	})
	await updateTournament(created.guild, changed, 0, context)
	expect(created.edit).toHaveBeenCalledTimes(1)
	const invalid = createGuild({ channel: { isTextBased: () => false } })
	await expect(updateTournament(invalid.guild, changed, 0, context)).rejects.toThrow(
		'Configured tournament channel is unavailable',
	)
	await updateTournament(created.guild, guildState(), 0, context)
})

test('FeedService schedules, polls, avoids overlapping activity work, and stops resources', async () => {
	const clearIntervalMock = mock(() => {})
	const callbacks: Array<() => void> = []
	const scheduler = {
		setInterval: mock((callback: () => void) => {
			callbacks.push(callback)
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
	const { context } = createMockContext({
		backend: { workerCursor },
		graphql: {
			query: mock(async () => tournamentData),
			subscribeToActivityEvents: mock((onChange: () => void) => {
				liveChange = onChange
				return { unsubscribe }
			}),
		},
	})
	const { client } = createClient()
	const service = new FeedService(client, context, scheduler as unknown as FeedScheduler)
	service.start()
	expect(callbacks).toHaveLength(2)
	liveChange?.()
	const first = service.pollActivity()
	await service.pollActivity()
	expect(workerCursor).toHaveBeenCalledTimes(1)
	release?.()
	await first
	callbacks[0]?.()
	callbacks[1]?.()
	await new Promise((resolve) => setTimeout(resolve, 0))
	service.stop()
	expect(clearIntervalMock).toHaveBeenCalledTimes(2)
	expect(unsubscribe).toHaveBeenCalledTimes(1)
})

test('FeedService contains activity, watch, guild, and tournament failures', async () => {
	const consoleError = spyOn(console, 'error').mockImplementation(() => {})
	const guild = createGuild().guild
	const { context } = createMockContext({
		backend: {
			workerCursor: mock(async () => Promise.reject(new Error('watch failed'))),
			guild: mock(async () => Promise.reject(new Error('guild failed'))),
		},
		graphql: { query: mock(async () => Promise.reject(new Error('tournament failed'))) },
	})
	const { client } = createClient([guild])
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
