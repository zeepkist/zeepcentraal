import type { Guild } from 'discord.js'
import type { CommandContext } from '../commands/context'
import type { DiscordActivityEvent, DiscordFeedKind, DiscordGuildState } from '../types'
import { eventMessage } from './event-message'
import { sendToChannel } from './send-to-channel'

const EVENT_FEED: Partial<Record<DiscordActivityEvent['kind'], DiscordFeedKind>> = {
	workshop: 'workshop',
	world_record: 'world_record',
	rank_batch: 'rank',
}

export async function processFeed(
	guild: Guild,
	state: DiscordGuildState,
	kind: DiscordFeedKind,
	context: CommandContext,
) {
	const feed = state.feeds.find((entry) => entry.kind === kind && entry.enabled)
	if (!feed || kind === 'totw' || kind === 'totm') return
	const events = await context.graphql.activityEvents(feed.cursorEventId)
	for (const event of events) {
		if (EVENT_FEED[event.kind] !== kind) {
			await context.backend.advanceFeed(guild.id, kind, event.id)
			continue
		}
		try {
			const delivery = await context.backend.delivery(guild.id, event.id)
			if (delivery?.status === 'sent') {
				await context.backend.advanceFeed(guild.id, kind, event.id)
				continue
			}
			const message = await eventMessage(event, context)
			if (!message) {
				await context.backend.advanceFeed(guild.id, kind, event.id)
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
			await context.backend.advanceFeed(guild.id, kind, event.id)
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
