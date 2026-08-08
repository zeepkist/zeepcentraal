import { type ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js'
import { displayContainer, replyPayload } from '../display'
import type { CommandContext } from './context'

export const helpDefinition = new SlashCommandBuilder()
	.setName('help')
	.setDescription('Show ZeepCentraal bot command guide')

export async function helpHandler(
	interaction: ChatInputCommandInteraction,
	_context: CommandContext,
) {
	await interaction.reply(
		replyPayload(
			displayContainer({
				description: 'Commands for records, competition, and community tools.',
				sections: [
					{
						content: '`/link` • `/unlink` • `/wr-ping` • `/watch`',
						heading: 'Account & notifications',
					},
					{
						content: '`/level` • `/user` • `/random-level` • `/compare`',
						heading: 'Discovery',
					},
					{
						content: '`/totw` • `/totm` • `/zsl` • `/playlist` • `/playlist-recommend`',
						heading: 'Competition & playlists',
					},
					{
						content: '`/stats` • `/stats-surface` • `/modkist` • `/gtr`',
						heading: 'Telemetry & setup',
					},
				],
				title: 'ZeepCentraal bot',
			}),
			{ ephemeral: true },
		),
	)
}
