import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
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
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: `WR-loss pings ${enabled ? 'enabled' : 'disabled'}.`,
	})
}
