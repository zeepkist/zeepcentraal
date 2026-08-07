import type { Client } from 'discord.js'
import type { CommandContext } from '../commands/context'
import { deliverWatches } from './deliver-watches'
import { eventMessage } from './event-message'
import { eventWatchTargets } from './event-watch-targets'

export async function processActivityWatches(client: Client, context: CommandContext) {
	const state = await context.backend.workerCursor('watch-events')
	const events = await context.graphql.activityEvents(state.cursorEventId)
	for (const event of events) {
		const watches = await context.backend.matchingWatches(eventWatchTargets(event))
		if (watches.length > 0) {
			const message = await eventMessage(event, context)
			if (message) {
				await deliverWatches(client, watches, `event:${event.id}`, message, context)
			}
		}
		await context.backend.advanceWorkerCursor('watch-events', event.id)
	}
}
