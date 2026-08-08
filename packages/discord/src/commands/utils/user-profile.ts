import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	type ChatInputCommandInteraction,
	type UserContextMenuCommandInteraction,
} from 'discord.js'
import { displayContainer, editPayload } from '../../display'
import { compactNumber, playerLabel } from '../../format'
import type { LinkedUser } from '../../types'
import type { CommandContext } from '../context'

export async function userProfileHandler(
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
	await interaction.editReply(
		editPayload(
			displayContainer({
				actions: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						new ButtonBuilder()
							.setLabel('Open profile')
							.setStyle(ButtonStyle.Link)
							.setURL(`${context.config.frontendUrl}/user/${typed.steamId}`),
					),
				],
				description: `Steam ID  \`${typed.steamId}\``,
				sections: [
					{
						content: [
							`**Rank**  ${typed.userPoints?.rank && typed.userPoints.rank > 0 ? `#${typed.userPoints.rank}` : 'Unranked'}  •  **Points**  ${compactNumber(typed.userPoints?.points)}`,
							`**World records**  ${typed.worldRecordGlobals?.totalCount ?? 0}`,
							`**Records / PBs**  ${typed.records?.totalCount ?? 0} / ${typed.personalBestGlobals?.totalCount ?? 0}`,
							`**Published levels / votes**  ${typed.levelItems?.totalCount ?? 0} / ${typed.votes?.totalCount ?? 0}`,
						].join('\n'),
						heading: 'Career summary',
					},
				],
				title: playerLabel(typed),
			}),
		),
	)
}
