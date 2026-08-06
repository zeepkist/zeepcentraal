import { SlashCommandBuilder } from 'discord.js'

export const botStatusDefinition = new SlashCommandBuilder()
	.setName('bot-status')
	.setDescription('Show bot and API health')
