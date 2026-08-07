import type { DiscordActivityEvent } from '../types'

export function eventLevelName(event: DiscordActivityEvent) {
	return event.level?.levelItems.nodes[0]?.name ?? String(event.payload?.name ?? 'Unknown level')
}
