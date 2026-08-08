import { expect, mock, test } from 'bun:test'
import { createFeedEvent, createFeedGuild } from '../../test/feed-mocks'
import { createMockContext } from '../../test/mocks'
import type { DiscordGuildFeed } from '../types'
import { processFeed } from './process-feed'

function createFeed(overrides: Partial<DiscordGuildFeed> = {}): DiscordGuildFeed {
	return {
		guildId: 'guild-1',
		kind: 'workshop',
		channelId: 'channel',
		enabled: true,
		cursorEventId: '0',
		...overrides,
	}
}

test('process feed skips disabled, tournament, unrelated, and replayed events', async () => {
	const { guild } = createFeedGuild()
	const { backend, context } = createMockContext()
	await processFeed(
		guild,
		createFeed({ enabled: false }),
		[createFeedEvent({ kind: 'workshop' })],
		context,
	)
	await processFeed(
		guild,
		createFeed({ kind: 'totw' }),
		[createFeedEvent({ kind: 'workshop' })],
		context,
	)
	await processFeed(guild, createFeed(), [createFeedEvent({ kind: 'vote' })], context)
	await processFeed(
		guild,
		createFeed({ cursorEventId: '1' }),
		[createFeedEvent({ kind: 'workshop' })],
		context,
	)
	expect(backend.delivery).not.toHaveBeenCalled()
	expect(backend.advanceFeed).not.toHaveBeenCalled()
})

test('process feed sends idempotently, resumes sent deliveries, and records failures', async () => {
	const feed = createFeed({ kind: 'world_record' })
	const event = createFeedEvent()
	const sentGuild = createFeedGuild()
	const success = createMockContext({
		backend: { delivery: mock(async () => null) },
	})
	await processFeed(sentGuild.guild, feed, [event], success.context)
	expect(success.backend.setDelivery).toHaveBeenCalledTimes(2)
	expect(success.backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'world_record', '1')

	const resumed = createMockContext({
		backend: { delivery: mock(async () => ({ status: 'sent' })) },
	})
	await processFeed(sentGuild.guild, feed, [event], resumed.context)
	expect(sentGuild.send).toHaveBeenCalledTimes(1)
	expect(resumed.backend.advanceFeed).toHaveBeenCalledTimes(1)

	const failedGuild = createFeedGuild({ channel: null })
	const failed = createMockContext({
		backend: { delivery: mock(async () => null) },
	})
	await expect(processFeed(failedGuild.guild, feed, [event], failed.context)).rejects.toThrow(
		'Configured channel is unavailable',
	)
	expect(failed.backend.setDelivery.mock.calls.at(-1)?.[0]).toMatchObject({
		status: 'failed',
		lastError: 'Configured channel is unavailable',
	})
})

test('process feed advances malformed rank events without sending empty messages', async () => {
	const feed = createFeed({ kind: 'rank' })
	const { guild, send } = createFeedGuild()
	const { backend, context } = createMockContext()
	await processFeed(
		guild,
		feed,
		[createFeedEvent({ kind: 'rank_batch', payload: null })],
		context,
	)
	expect(send).not.toHaveBeenCalled()
	expect(backend.setDelivery).not.toHaveBeenCalled()
	expect(backend.advanceFeed).toHaveBeenCalledWith('guild-1', 'rank', '1')
})

test('process feed posts workshop batches oldest first', async () => {
	const feed = createFeed()
	const { guild, send } = createFeedGuild()
	const { backend, context } = createMockContext({
		backend: { delivery: mock(async () => null) },
	})
	await processFeed(
		guild,
		feed,
		[
			createFeedEvent({
				id: '1',
				kind: 'workshop',
				occurredAt: '2026-08-06T12:00:00Z',
			}),
			createFeedEvent({
				id: '2',
				kind: 'workshop',
				occurredAt: '2026-08-06T12:01:00Z',
			}),
		],
		context,
	)
	expect(send).toHaveBeenCalledTimes(2)
	expect(backend.advanceFeed.mock.calls.map((call) => call[2])).toEqual(['1', '2'])
})
