import { expect, mock, test } from 'bun:test'
import { createFeedEvent, createFeedGuild, createFeedGuildState } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import { processFeed } from './process-feed'

test('process feed skips disabled/tournament feeds and advances unrelated events', async () => {
	const { guild } = createFeedGuild()
	const { backend, context, graphql } = createMockContext({
		graphql: { activityEvents: mock(async () => [createFeedEvent({ kind: 'vote' })]) },
	})
	await processFeed(guild, createFeedGuildState(), 'workshop', context)
	await processFeed(
		guild,
		createFeedGuildState({
			feeds: [{ kind: 'totw', channelId: 'channel', enabled: true, cursorEventId: '0' }],
		}),
		'totw',
		context,
	)
	expect(graphql.activityEvents).not.toHaveBeenCalled()
	await processFeed(
		guild,
		createFeedGuildState({
			feeds: [{ kind: 'workshop', channelId: 'channel', enabled: true, cursorEventId: '0' }],
		}),
		'workshop',
		context,
	)
	expect(backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'workshop', 'event-1')
})

test('process feed sends idempotently, resumes sent deliveries, and records failures', async () => {
	const state = createFeedGuildState({
		feeds: [{ kind: 'world_record', channelId: 'channel', enabled: true, cursorEventId: '0' }],
	})
	const sentGuild = createFeedGuild()
	const success = createMockContext({
		backend: { delivery: mock(async () => null) },
		graphql: { activityEvents: mock(async () => [createFeedEvent()]) },
	})
	await processFeed(sentGuild.guild, state, 'world_record', success.context)
	expect(success.backend.setDelivery).toHaveBeenCalledTimes(2)
	expect(success.backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'world_record', 'event-1')

	const resumed = createMockContext({
		backend: { delivery: mock(async () => ({ status: 'sent' })) },
		graphql: { activityEvents: mock(async () => [createFeedEvent()]) },
	})
	await processFeed(sentGuild.guild, state, 'world_record', resumed.context)
	expect(sentGuild.send).toHaveBeenCalledTimes(1)
	expect(resumed.backend.advanceFeed).toHaveBeenCalledTimes(1)

	const failedGuild = createFeedGuild({ channel: null })
	const failed = createMockContext({
		backend: { delivery: mock(async () => null) },
		graphql: { activityEvents: mock(async () => [createFeedEvent()]) },
	})
	await expect(
		processFeed(failedGuild.guild, state, 'world_record', failed.context),
	).rejects.toThrow('Configured channel is unavailable')
	expect(failed.backend.setDelivery.mock.calls.at(-1)?.[0]).toMatchObject({
		status: 'failed',
		lastError: 'Configured channel is unavailable',
	})
})

test('process feed advances malformed rank events without sending empty messages', async () => {
	const state = createFeedGuildState({
		feeds: [{ kind: 'rank', channelId: 'channel', enabled: true, cursorEventId: '0' }],
	})
	const { guild, send } = createFeedGuild()
	const { backend, context } = createMockContext({
		graphql: {
			activityEvents: mock(async () => [
				createFeedEvent({ kind: 'rank_batch', payload: null }),
			]),
		},
	})
	await processFeed(guild, state, 'rank', context)
	expect(send).not.toHaveBeenCalled()
	expect(backend.setDelivery).not.toHaveBeenCalled()
	expect(backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'rank', 'event-1')
})

test('process feed posts multi-event batches oldest first', async () => {
	const state = createFeedGuildState({
		feeds: [{ kind: 'world_record', channelId: 'channel', enabled: true, cursorEventId: '0' }],
	})
	const { guild, send } = createFeedGuild()
	const { backend, context } = createMockContext({
		backend: { delivery: mock(async () => null) },
		graphql: {
			activityEvents: mock(async () => [
				createFeedEvent({ id: 'event-1', occurredAt: '2026-08-06T12:00:00Z' }),
				createFeedEvent({ id: 'event-2', occurredAt: '2026-08-06T12:01:00Z' }),
			]),
		},
	})
	await processFeed(guild, state, 'world_record', context)
	expect(send).toHaveBeenCalledTimes(2)
	expect(backend.advanceFeed.mock.calls.map((call) => call[2])).toEqual(['event-1', 'event-2'])
})
