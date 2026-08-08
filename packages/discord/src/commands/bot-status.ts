import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { displayContainer, editPayload, SUCCESS_COLOR } from '../display'
import type { CommandContext } from './context'

export const botStatusDefinition = new SlashCommandBuilder()
	.setName('bot-status')
	.setDescription('Show bot and API health')

export async function botStatusHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })
	const started = context.runtime.monotonicNow()
	await context.graphql.userByFilter({ id: { equalTo: -1 } })
	await interaction.editReply(
		editPayload(
			displayContainer({
				accentColor: SUCCESS_COLOR,
				description: 'All systems operational.',
				sections: [
					{
						content: `🟢 **Discord gateway**  Connected\n🟢 **GraphQL POST**  Healthy • ${Math.round(context.runtime.monotonicNow() - started)} ms`,
						heading: 'Service health',
					},
				],
				title: 'Bot status',
			}),
		),
	)
}
