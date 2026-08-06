import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { baseEmbed, SUCCESS_COLOR } from '../format'
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
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			embeds: [
				baseEmbed(
					'Link ZeepCentraal',
					`Use account-link button at ${context.config.frontendUrl}/settings/discord, or enter generated 8-digit code with \`/link code:12345678\`.`,
				),
			],
		})
		return
	}
	const result = await context.backend.redeem(code, interaction.user.id)
	if (result.status !== 'linked') throw new Error(`Link failed: ${result.status}.`)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		embeds: [
			{
				...baseEmbed(
					'Account linked',
					'You can now login to ZeepCentraal with Discord and extended bot features are unlocked.',
				),
				color: SUCCESS_COLOR,
			},
		],
	})
}
