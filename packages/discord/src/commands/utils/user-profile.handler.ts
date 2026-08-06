import type { ChatInputCommandInteraction, UserContextMenuCommandInteraction } from 'discord.js'
import { baseEmbed, compactNumber, playerLabel, safeMentions } from '../../format'
import type { LinkedUser } from '../../types'
import type { CommandContext } from '../context'

export async function renderUser(
	interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction,
	context: CommandContext,
	user: LinkedUser,
) {
	const profile = await context.graphql.userByFilter({ id: { equalTo: user.id } })
	if (!profile) throw new Error('Player not found.')
	const typed = profile as {
		discordId: string | null
		id: number
		levelItems?: { totalCount: number }
		personalBestGlobals?: { totalCount: number }
		records?: { totalCount: number }
		steamId: string
		steamName: string | null
		userPoints?: {
			points: number
			rank: number
			totalPoints: number
			worldRecords: number
		} | null
		votes?: { totalCount: number }
		worldRecordGlobals?: { totalCount: number }
	}
	await interaction.editReply({
		embeds: [
			{
				...baseEmbed(playerLabel(typed), `Steam ID: \`${typed.steamId}\``),
				url: `${context.config.frontendUrl}/user/${typed.steamId}`,
				fields: [
					{
						name: 'Rank',
						value:
							typed.userPoints?.rank && typed.userPoints.rank > 0
								? `#${typed.userPoints.rank}`
								: 'Unranked',
						inline: true,
					},
					{
						name: 'Ranked points',
						value: compactNumber(typed.userPoints?.points),
						inline: true,
					},
					{
						name: 'WRs',
						value: String(typed.worldRecordGlobals?.totalCount ?? 0),
						inline: true,
					},
					{
						name: 'Records / PBs',
						value: `${typed.records?.totalCount ?? 0} / ${typed.personalBestGlobals?.totalCount ?? 0}`,
						inline: true,
					},
					{
						name: 'Published levels',
						value: String(typed.levelItems?.totalCount ?? 0),
						inline: true,
					},
					{ name: 'Votes', value: String(typed.votes?.totalCount ?? 0), inline: true },
				],
			},
		],
		allowedMentions: safeMentions,
	})
}
