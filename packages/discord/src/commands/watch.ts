import { type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js'
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
		await interaction.reply({
			flags: MessageFlags.Ephemeral,
			...createPages(context, interaction.user.id, 'Your watches', rows),
		})
		return
	}
	if (action === 'remove') {
		await context.backend.removeWatch(
			interaction.user.id,
			interaction.options.getString('id', true),
		)
		await interaction.reply({ flags: MessageFlags.Ephemeral, content: 'Watch removed.' })
		return
	}
	await context.backend.addWatch(
		interaction.user.id,
		interaction.options.getString('kind', true),
		interaction.options.getString('target', true),
	)
	await interaction.reply({
		flags: MessageFlags.Ephemeral,
		content: 'Watch added. Updates arrive by DM.',
	})
}
