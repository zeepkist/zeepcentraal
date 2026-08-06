import type { ChatInputCommandInteraction } from 'discord.js'
import { baseEmbed, compactNumber, playerLabel, safeMentions } from '../format'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'

export async function handleCompare(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const first = linkedUserOrThrow(await context.backend.user(interaction.user.id))
	const secondDiscord = interaction.options.getUser('player', true)
	const second = linkedUserOrThrow(await context.backend.user(secondDiscord.id))
	const profiles = await Promise.all([
		context.graphql.userByFilter({ id: { equalTo: first.id } }),
		context.graphql.userByFilter({ id: { equalTo: second.id } }),
	])
	const rows = profiles.map((profile, index) => {
		const typed = profile as {
			discordId: string
			steamName: string
			userPoints?: { points: number; rank: number; worldRecords: number } | null
		}
		return `${index === 0 ? 'You' : 'Opponent'}: **${playerLabel(typed)}** • rank #${typed.userPoints?.rank ?? '-'} • ${compactNumber(typed.userPoints?.points)} pts • ${typed.userPoints?.worldRecords ?? 0} WRs`
	})
	await interaction.editReply({
		embeds: [baseEmbed('Player comparison', rows.join('\n'))],
		allowedMentions: safeMentions,
	})
}
