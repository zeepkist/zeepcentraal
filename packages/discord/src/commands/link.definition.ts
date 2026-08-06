import { SlashCommandBuilder } from 'discord.js'

export const linkDefinition = new SlashCommandBuilder()
	.setName('link')
	.setDescription('Link your Discord and ZeepCentraal accounts')
	.addStringOption((option) =>
		option
			.setName('code')
			.setDescription('8-digit code from zeepki.st/settings/discord')
			.setRequired(false)
			.setMinLength(8)
			.setMaxLength(8),
	)
