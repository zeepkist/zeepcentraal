import type { MessageCreateOptions } from 'discord.js'
import type { CommandContext } from '../commands/context'
import { baseEmbed, playerLabel, safeMentions, truncate } from '../format'
import type { DiscordActivityEvent } from '../types'

type RankChange = {
	idUser: number
	previousRank: number
	rank: number
}

function validRank(rank: unknown): rank is number {
	return Number.isSafeInteger(rank) && (rank === -1 || (typeof rank === 'number' && rank > 0))
}

function rankChanges(event: DiscordActivityEvent): RankChange[] {
	if (!Array.isArray(event.payload?.changes)) return []
	return event.payload.changes.filter((value): value is RankChange => {
		if (value === null || typeof value !== 'object') return false
		const change = value as Partial<RankChange>
		return (
			Number.isSafeInteger(change.idUser) &&
			(change.idUser ?? 0) > 0 &&
			validRank(change.previousRank) &&
			validRank(change.rank) &&
			change.previousRank !== change.rank
		)
	})
}

function rankLabel(rank: number) {
	return rank === -1 ? 'Unranked' : `#${rank}`
}

export async function rankMessage(event: DiscordActivityEvent, context: CommandContext) {
	const changes = rankChanges(event)
	if (changes.length === 0) return null
	const users = await context.graphql.usersByIds(changes.map((change) => change.idUser))
	const rows = changes.slice(0, 40).map((change) => {
		const direction =
			change.rank !== -1 && (change.previousRank === -1 || change.rank < change.previousRank)
				? '▲'
				: '▼'
		return `${direction} ${playerLabel(users.get(change.idUser))}: ${rankLabel(change.previousRank)} → ${rankLabel(change.rank)}`
	})
	if (changes.length > rows.length) rows.push(`…and ${changes.length - rows.length} more`)
	return {
		embeds: [
			baseEmbed(
				`Rank changes • ${changes.length} ${changes.length === 1 ? 'player' : 'players'}`,
				truncate(rows.join('\n'), 4000),
			),
		],
		allowedMentions: safeMentions,
	} satisfies MessageCreateOptions
}
