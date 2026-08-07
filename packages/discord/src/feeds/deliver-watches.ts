import type { Client, MessageCreateOptions } from 'discord.js'
import type { CommandContext } from '../commands/context'
import { safeMentions } from '../format'
import { permanentDmFailure } from './permanent-dm-failure'

type Watch = Awaited<ReturnType<CommandContext['backend']['matchingWatches']>>[number]

export async function deliverWatches(
	client: Client,
	watches: Watch[],
	deliveryKey: string,
	message: MessageCreateOptions,
	context: CommandContext,
) {
	const recipients = new Map<string, Watch[]>()
	for (const watch of watches) {
		if (watch.lastDeliveryKey === deliveryKey) continue
		const entries = recipients.get(watch.discordId) ?? []
		entries.push(watch)
		recipients.set(watch.discordId, entries)
	}
	for (const [discordId, recipientWatches] of recipients) {
		try {
			const recipient = await client.users.fetch(discordId)
			await recipient.send({ ...message, content: undefined, allowedMentions: safeMentions })
			for (const watch of recipientWatches) {
				await context.backend.updateWatchDelivery(watch.id, {
					paused: false,
					lastError: null,
					deliveryKey,
				})
			}
		} catch (error) {
			const paused = permanentDmFailure(error)
			const lastError = error instanceof Error ? error.message.slice(0, 1000) : String(error)
			for (const watch of recipientWatches) {
				await context.backend.updateWatchDelivery(watch.id, {
					paused,
					lastError,
					deliveryKey: null,
				})
			}
			if (!paused) throw error
		}
	}
}
