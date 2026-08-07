import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import { baseEmbed } from '../../format'
import type { CommandContext } from '../context'

export async function modkistGtrHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply({ flags: MessageFlags.Ephemeral })
	const state = await context.backend.user(interaction.user.id)
	const fields = []
	if (state.linkedUser) {
		const versions = await context.graphql.modVersions(state.linkedUser.id)
		const current = versions.records.nodes[0]?.modVersion ?? 'No submitted record'
		const published = versions.versions.nodes[0]
		fields.push(
			{ name: 'Your latest submitted GTR', value: current, inline: true },
			{
				name: 'Latest / minimum',
				value: `${published?.latest ?? 'Unknown'} / ${published?.minimum ?? 'Unknown'}`,
				inline: true,
			},
		)
	}
	await interaction.editReply({
		embeds: [
			{
				...baseEmbed(
					'Modkist and GTR setup',
					'Install and update guide: https://zeepki.st/wiki/setup-modkist',
				),
				fields,
			},
		],
	})
}
