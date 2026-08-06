import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js'

export const zeepCentraalProfileDefinition = new ContextMenuCommandBuilder()
	.setName('ZeepCentraal profile')
	.setType(ApplicationCommandType.User)
