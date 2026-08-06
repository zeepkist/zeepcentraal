import { SlashCommandBuilder } from 'discord.js'

export const helpDefinition = new SlashCommandBuilder()
	.setName('help')
	.setDescription('Show ZeepCentraal bot command guide')
