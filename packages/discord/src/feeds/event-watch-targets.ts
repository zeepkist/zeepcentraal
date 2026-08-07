import type { DiscordActivityEvent } from '../types'
import { aliases } from './aliases'

export function eventWatchTargets(event: DiscordActivityEvent) {
	const item = event.level?.levelItems.nodes[0]
	const rankUserIds = Array.isArray(event.payload?.changes)
		? (event.payload.changes as Array<{ idUser?: unknown }>)
				.map((change) => change.idUser)
				.filter((value): value is string | number =>
					['string', 'number'].includes(typeof value),
				)
				.map(String)
		: []
	return [
		{
			kind: 'player' as const,
			targetIds: [...aliases(event.user), ...aliases(event.previousUser), ...rankUserIds],
		},
		{
			kind: 'level' as const,
			targetIds: event.level
				? [String(event.level.id), event.level.xxHash, item?.name ?? '']
				: [],
		},
		{ kind: 'author' as const, targetIds: aliases(item?.author ?? null) },
	]
}
