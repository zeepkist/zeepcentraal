import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js'
import { displayContainer, replyPayload, SUCCESS_COLOR } from '../display'
import type { CommandContext } from './context'

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

export async function linkHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	const code = interaction.options.getString('code')
	if (!code) {
		await interaction.reply(
			replyPayload(
				displayContainer({
					actions: [
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setLabel('Open account settings')
								.setStyle(ButtonStyle.Link)
								.setURL(`${context.config.frontendUrl}/settings/discord`),
						),
					],
					description: 'Generate account-link code, then run `/link code:12345678`.',
					title: 'Link ZeepCentraal',
				}),
				{ ephemeral: true },
			),
		)
		return
	}
	const result = await context.backend.redeem(code, interaction.user.id)
	if (result.status !== 'linked') throw new Error(`Link failed: ${result.status}.`)
	await interaction.reply(
		replyPayload(
			displayContainer({
				accentColor: SUCCESS_COLOR,
				description:
					'Discord login and extended bot features are now available for your account.',
				title: 'Account linked',
			}),
			{ ephemeral: true },
		),
	)
}
