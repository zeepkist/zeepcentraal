import {
	ChannelType,
	type ChatInputCommandInteraction,
	MessageFlags,
	PermissionFlagsBits,
	SlashCommandBuilder,
} from 'discord.js'
import { baseEmbed, SUCCESS_COLOR } from '../format'
import type { DiscordFeedKind } from '../types'
import type { CommandContext } from './context'

const feedKinds = [
	['workshop', 'Public workshop items'],
	['world_record', 'World records'],
	['rank', 'Rank changes'],
	['totw', 'Track of the Week'],
	['totm', 'Track of the Month'],
] as const

export const feedDefinition = new SlashCommandBuilder()
	.setName('feed')
	.setDescription('Configure ZeepCentraal feed for this server')
	.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
	.addStringOption((option) =>
		option
			.setName('kind')
			.setDescription('Feed type')
			.setRequired(true)
			.addChoices(...feedKinds.map(([value, name]) => ({ value, name }))),
	)
	.addChannelOption((option) =>
		option
			.setName('channel')
			.setDescription('Target channel')
			.setRequired(true)
			.addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
	)
	.addBooleanOption((option) =>
		option.setName('enabled').setDescription('Enable feed').setRequired(true),
	)

export async function feedHandler(
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
