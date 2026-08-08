import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { displayContainer, replyPayload, SUCCESS_COLOR } from '../display'
import type { CommandContext } from './context'

export const wrPingDefinition = new SlashCommandBuilder()
	.setName('wr-ping')
	.setDescription('Configure ping when you lose a world record')
	.addBooleanOption((option) =>
		option.setName('enabled').setDescription('Ping on WR loss').setRequired(true),
	)

export async function wrPingHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	const enabled = interaction.options.getBoolean('enabled', true)
	await context.backend.setPreference(interaction.user.id, enabled)
	await interaction.reply(
		replyPayload(
			displayContainer({
				accentColor: SUCCESS_COLOR,
				description: `World-record loss pings ${enabled ? 'enabled' : 'disabled'}.`,
				title: 'Notification preference updated',
			}),
			{ ephemeral: true },
		),
	)
}
