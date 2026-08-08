import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
import { displayContainer, replyPayload, SUCCESS_COLOR } from '../display'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { createPages } from './utils/pagination'

export const watchDefinition = new SlashCommandBuilder()
	.setName('watch')
	.setDescription('Manage direct-message watches')
	.addSubcommand((subcommand) =>
		subcommand
			.setName('add')
			.setDescription('Watch a player, level, author, or tournament')
			.addStringOption((option) =>
				option
					.setName('kind')
					.setDescription('Watch type')
					.setRequired(true)
					.addChoices(
						{ name: 'Player', value: 'player' },
						{ name: 'Level', value: 'level' },
						{ name: 'Author', value: 'author' },
						{ name: 'Tournament', value: 'tournament' },
					),
			)
			.addStringOption((option) =>
				option
					.setName('target')
					.setDescription('ID, hash, name, or slug')
					.setRequired(true),
			),
	)
	.addSubcommand((subcommand) => subcommand.setName('list').setDescription('List active watches'))
	.addSubcommand((subcommand) =>
		subcommand
			.setName('remove')
			.setDescription('Remove a watch')
			.addStringOption((option) =>
				option.setName('id').setDescription('Watch ID from /watch list').setRequired(true),
			),
	)

export async function watchHandler(
	interaction: ChatInputCommandInteraction,
	context: CommandContext,
) {
	const state = await context.backend.user(interaction.user.id)
	linkedUserOrThrow(state)
	const action = interaction.options.getSubcommand()
	if (action === 'list') {
		const rows = state.watches.map(
			(watch) =>
				`\`${watch.id}\` • **${watch.kind}** • ${watch.targetId}${watch.paused ? ' • paused' : ''}`,
		)
		const response = createPages(context, interaction.user.id, 'Your watches', rows, 10, {
			emptyDescription: 'No watches configured.',
			sectionHeading: 'Watches',
		})
		await interaction.reply({
			allowedMentions: response.allowedMentions,
			components: response.components,
			flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
		})
		return
	}
	if (action === 'remove') {
		await context.backend.removeWatch(
			interaction.user.id,
			interaction.options.getString('id', true),
		)
		await interaction.reply(
			replyPayload(
				displayContainer({
					accentColor: SUCCESS_COLOR,
					description: 'Watch removed.',
					title: 'Watch updated',
				}),
				{ ephemeral: true },
			),
		)
		return
	}
	await context.backend.addWatch(
		interaction.user.id,
		interaction.options.getString('kind', true),
		interaction.options.getString('target', true),
	)
	await interaction.reply(
		replyPayload(
			displayContainer({
				accentColor: SUCCESS_COLOR,
				description: 'Watch added. Updates arrive by direct message.',
				title: 'Watch active',
			}),
			{ ephemeral: true },
		),
	)
}
