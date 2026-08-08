import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { displayContainer, replyPayload, SUCCESS_COLOR } from '../display'
import type { CommandContext } from './context'

export const unlinkDefinition = new SlashCommandBuilder()
	.setName('unlink')
	.setDescription('Unlink your Discord and ZeepCentraal accounts')

export async function unlinkHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await context.backend.unlink(interaction.user.id)
	await interaction.reply(
		replyPayload(
			displayContainer({
				accentColor: SUCCESS_COLOR,
				description: 'Discord account unlinked.',
				title: 'Account unlinked',
			}),
			{ ephemeral: true },
		),
	)
}
