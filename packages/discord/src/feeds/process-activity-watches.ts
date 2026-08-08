import type { Client } from 'discord.js'
import type { CommandContext } from '../commands/context'
import type { DiscordActivityEvent } from '../types'
import { deliverWatches } from './deliver-watches'
import { isEventAfterCursor } from './event-cursor'
import { eventMessage } from './event-message'
import { eventWatchTargets } from './event-watch-targets'

export async function processActivityWatches(
	client: Client,
	events: DiscordActivityEvent[],
	context: CommandContext,
) {
	const state = await context.backend.workerCursor('watch-events')
	let cursorEventId = state.cursorEventId
	for (const event of events) {
		if (!isEventAfterCursor(event.id, cursorEventId)) continue
		const watches = await context.backend.matchingWatches(eventWatchTargets(event))
		if (watches.length > 0) {
			const message = await eventMessage(event, context, { includeLossPing: false })
			if (message) {
				await deliverWatches(client, watches, `event:${event.id}`, message, context)
			}
		}
		await context.backend.advanceWorkerCursor('watch-events', event.id)
		cursorEventId = event.id
	}
}
