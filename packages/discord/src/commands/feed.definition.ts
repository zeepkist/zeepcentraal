import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js'

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
