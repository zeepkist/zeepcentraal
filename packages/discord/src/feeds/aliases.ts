import type { DiscordActivityEvent } from '../types'

export function aliases(user: DiscordActivityEvent['user']) {
	if (!user) return []
	return [user.id, user.steamId, user.discordId, user.steamName]
		.filter((value): value is string | number | bigint => value !== null && value !== undefined)
		.map(String)
}
