import type { MessageCreateOptions } from 'discord.js'
import type { CommandContext } from '../commands/context'
import { displayContainer, INFO_COLOR, messagePayload } from '../display'
import { playerLabel, truncate } from '../format'
import type { DiscordActivityEvent } from '../types'

const pointsFormatter = new Intl.NumberFormat('en')

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

function rankOrder(rank: number) {
	return rank === -1 ? Number.MAX_SAFE_INTEGER : rank
}

function pointsLabel(points: number | undefined) {
	return typeof points === 'number' && Number.isFinite(points)
		? pointsFormatter.format(points)
		: 'unknown'
}

export async function rankMessage(event: DiscordActivityEvent, context: CommandContext) {
	const changes = rankChanges(event).sort(
		(left, right) => rankOrder(left.rank) - rankOrder(right.rank) || left.idUser - right.idUser,
	)
	if (changes.length === 0) return null
	const users = await context.graphql.usersByIds(changes.map((change) => change.idUser))
	const rows = changes.slice(0, 30).map((change) => {
		const direction =
			change.rank !== -1 && (change.previousRank === -1 || change.rank < change.previousRank)
				? '<:up:1535467505831780455>'
				: '<:down:1535467431655637072>'
		const user = users.get(change.idUser)
		return `${direction} ${playerLabel(user)}: ${rankLabel(change.previousRank)} → ${rankLabel(change.rank)} (${pointsLabel(user?.userPoints?.points)} pts)`
	})
	if (changes.length > rows.length) rows.push(`…and ${changes.length - rows.length} more`)
	return messagePayload(
		displayContainer({
			accentColor: INFO_COLOR,
			description: `${changes.length} ${changes.length === 1 ? 'player moved' : 'players moved'} after ranking recalculation.`,
			footer: `ZeepCentraal • <t:${Math.floor(new Date(event.occurredAt).getTime() / 1000)}:R>`,
			sections: [
				{
					content: truncate(rows.join('\n'), 3000),
					heading: 'Movements',
				},
			],
			title: 'Rank changes',
		}),
	) satisfies MessageCreateOptions
}
