import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { baseEmbed, SUCCESS_COLOR } from '../format'
import type { CommandContext } from './context'

export async function handleBotStatus(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })
	const started = context.runtime.monotonicNow()
	await context.graphql.userByFilter({ id: { equalTo: -1 } })
	await interaction.editReply({
		embeds: [
			{
				...baseEmbed(
					'Bot status',
					`Discord gateway: connected\nGraphQL POST: healthy (${Math.round(context.runtime.monotonicNow() - started)} ms)`,
				),
				color: SUCCESS_COLOR,
			},
		],
	})
}
