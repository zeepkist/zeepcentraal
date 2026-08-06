import { SlashCommandBuilder } from 'discord.js'

export const userDefinition = new SlashCommandBuilder()
	.setName('user')
	.setDescription('Get ZeepCentraal player information')
	.addUserOption((option) =>
		option.setName('discord').setDescription('Linked Discord user').setRequired(false),
	)
	.addStringOption((option) =>
		option.setName('id').setDescription('Steam ID or ZeepCentraal user ID').setRequired(false),
	)
