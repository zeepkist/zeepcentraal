import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { baseEmbed } from '../format'
import type { CommandContext } from './context'

export const helpDefinition = new SlashCommandBuilder()
	.setName('help')
	.setDescription('Show ZeepCentraal bot command guide')

export async function helpHandler(
	interaction: ChatInputCommandInteraction,
	_context: CommandContext,
) {
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		embeds: [
			baseEmbed(
				'ZeepCentraal bot',
				'Account: `/link`, `/unlink`, `/wr-ping`\nDiscovery: `/level`, `/user`, `/random-level`, `/compare`\nCompetition: `/totw`, `/totm`, `/zsl`\nPlaylists: `/playlist`, `/playlist-recommend`\nTelemetry: `/stats`, `/stats-surface`\nNotifications: `/watch`\nSetup: `/modkist`, `/gtr`',
			),
		],
	})
}
