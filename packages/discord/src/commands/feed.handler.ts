import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { baseEmbed, SUCCESS_COLOR } from '../format'
import type { DiscordFeedKind } from '../types'
import type { CommandContext } from './context'

export async function handleFeed(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	if (!interaction.guildId) throw new Error('Run this command inside a server.')
	const kind = interaction.options.getString('kind', true) as DiscordFeedKind
	const channel = interaction.options.getChannel('channel', true)
	const enabled = interaction.options.getBoolean('enabled', true)
	await context.backend.setFeed(interaction.guildId, kind, channel.id, enabled)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		embeds: [
			{
				...baseEmbed(
					'Feed updated',
					`${kind} feed ${enabled ? 'enabled' : 'disabled'} in <#${channel.id}>.`,
				),
				color: SUCCESS_COLOR,
			},
		],
	})
}
