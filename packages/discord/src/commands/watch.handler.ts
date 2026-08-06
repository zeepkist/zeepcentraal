import { type ChatInputCommandInteraction, MessageFlags } from 'discord.js'
import type { CommandContext } from './context'
import { linkedUserOrThrow } from './utils/linked-user'
import { createPages } from './utils/pagination.handler'

export async function handleWatch(
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
