import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	MessageFlags,
} from 'discord.js'
import { displayContainer, editPayload } from '../../display'
import type { CommandContext } from '../context'

export async function modkistGtrHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })
	const state = await context.backend.user(interaction.user.id)
	const sections: Array<{ content: string; heading: string }> = []
	if (state.linkedUser) {
		const versions = await context.graphql.modVersions(state.linkedUser.id)
		const current = versions.records.nodes[0]?.modVersion ?? 'No submitted record'
		const published = versions.versions.nodes[0]
		sections.push({
			content: `**Your submitted version**  ${current}\n**Latest / minimum**  ${published?.latest ?? 'Unknown'} / ${published?.minimum ?? 'Unknown'}`,
			heading: 'Version status',
		})
	}
	await interaction.editReply(
		editPayload(
			displayContainer({
				actions: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setLabel('Open setup guide')
							.setStyle(ButtonStyle.Link)
							.setURL('https://zeepki.st/wiki/setup-modkist'),
					),
				],
				description: 'Install, update, and verify Modkist with GTR.',
				sections,
				title: 'Modkist and GTR setup',
			}),
		),
	)
}
