import { Zc_LevelsDocument } from '@zeepkist/graphql/generated'
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	SlashCommandBuilder,
} from 'discord.js'
import { displayContainer, editPayload } from '../display'
import { compactNumber } from '../format'
import type { CommandContext } from './context'
import type { PlaylistLevel } from './utils/playlist'

export const randomLevelDefinition = new SlashCommandBuilder()
	.setName('random-level')
	.setDescription('Pick a random public level')
	.addIntegerOption((option) =>
		option.setName('minimum-points').setDescription('Minimum level points'),
	)

export async function randomLevelHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	await interaction.deferReply()
	const minimum = interaction.options.getInteger('minimum-points') ?? 0
	const data = await context.graphql.query<Record<string, unknown>>(Zc_LevelsDocument, {
		first: 100,
		filter: {
			publiclyVisible: { equalTo: true },
			levelPoints: { points: { greaterThanOrEqualTo: minimum } },
			levelItems: { some: { deleted: { equalTo: false } } },
		},
		orderBy: ['ID_DESC'],
	})
	const levels = (
		(data as { levels?: { edges: Array<{ node: PlaylistLevel }> } }).levels?.edges ?? []
	).map((edge) => edge.node)
	const level = levels[Math.floor(context.runtime.random() * levels.length)]
	if (!level) throw new Error('No public level matched.')
	await interaction.editReply(
		editPayload(
			displayContainer({
				actions: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setLabel('Open level')
							.setStyle(ButtonStyle.Link)
							.setURL(`${context.config.frontendUrl}/level/${level.xxHash}`),
					),
				],
				description: `Random public level • ${compactNumber(level.levelPoints?.points)} ranked points`,
				title: level.levelItems?.nodes[0]?.name ?? level.xxHash,
			}),
		),
	)
}
