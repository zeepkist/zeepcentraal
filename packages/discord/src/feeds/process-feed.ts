import { getMeter, withActiveSpan } from '@zeepkist/telemetry'
import type { Guild } from 'discord.js'
import type { CommandContext } from '../commands/context'
import type { DiscordActivityEvent, DiscordFeedKind, DiscordGuildFeed } from '../types'
import { isEventAfterCursor } from './event-cursor'
import { eventMessage } from './event-message'
import { sendToChannel } from './send-to-channel'

const EVENT_FEED: Partial<Record<DiscordActivityEvent['kind'], DiscordFeedKind>> = {
	workshop: 'workshop',
	world_record: 'world_record',
	rank_batch: 'rank',
}

const meter = getMeter('zeepcentraal-discord')
const feedDuration = meter.createHistogram('discord.feed.duration', { unit: 's' })
const feedOutcomes = meter.createCounter('discord.feed.operations')

export function activityFeedKind(event: DiscordActivityEvent) {
	return EVENT_FEED[event.kind]
}

export async function processFeed(
	guild: Guild,
	feed: DiscordGuildFeed,
	events: DiscordActivityEvent[],
	context: CommandContext,
) {
	if (!feed.enabled || feed.kind === 'totw' || feed.kind === 'totm') return
	const startedAt = performance.now()
	try {
		await withActiveSpan(
			'discord.feed.deliver',
			{ attributes: { 'discord.feed.kind': feed.kind } },
			async (span) => {
				span.addEvent('feed.batch', { 'feed.event.count': events.length })
				await processFeedEvents(guild, feed, events, context)
			},
		)
		feedOutcomes.add(1, { 'discord.feed.kind': feed.kind, outcome: 'success' })
	} catch (error) {
		feedOutcomes.add(1, { 'discord.feed.kind': feed.kind, outcome: 'error' })
		throw error
	} finally {
		feedDuration.record((performance.now() - startedAt) / 1000, {
			'discord.feed.kind': feed.kind,
		})
	}
}

async function processFeedEvents(
	guild: Guild,
	feed: DiscordGuildFeed,
	events: DiscordActivityEvent[],
	context: CommandContext,
) {
	let cursorEventId = feed.cursorEventId
	for (const event of events) {
		if (activityFeedKind(event) !== feed.kind) continue
		if (!isEventAfterCursor(event.id, cursorEventId)) continue
		try {
			const delivery = await context.backend.delivery(guild.id, event.id)
			if (delivery?.status === 'sent') {
				await context.backend.advanceFeed(guild.id, feed.kind, event.id)
				cursorEventId = event.id
				continue
			}
			const message = await eventMessage(event, context)
			if (!message) {
				await context.backend.advanceFeed(guild.id, feed.kind, event.id)
				cursorEventId = event.id
				continue
			}
			await context.backend.setDelivery({
				guildId: guild.id,
				eventId: event.id,
				channelId: feed.channelId,
				messageId: null,
				status: 'pending',
			})
			const sent = await sendToChannel(guild, feed.channelId, message)
			await context.backend.setDelivery({
				guildId: guild.id,
				eventId: event.id,
				channelId: feed.channelId,
				messageId: sent.id,
				status: 'sent',
			})
			await context.backend.advanceFeed(guild.id, feed.kind, event.id)
			cursorEventId = event.id
		} catch (error) {
			await context.backend.setDelivery({
				guildId: guild.id,
				eventId: event.id,
				channelId: feed.channelId,
				messageId: null,
				status: 'failed',
				lastError: error instanceof Error ? error.message.slice(0, 1000) : String(error),
			})
			throw error
		}
	}
}
